"""
游戏下注模块 - 处理下注逻辑
"""
import asyncio
from datetime import datetime
from typing import Dict, Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.models.schemas import BetRecord
from .session import get_session, get_session_lock, broadcast_event
from .state import get_or_create_state
from .logging import write_game_log
import copy

async def place_bet(
    db: AsyncSession,
    game_number: int,
    direction: str,
    amount: float,
) -> Dict[str, Any]:
    """
    下注 - 在指定局上下注
    """
    lock = get_session_lock()
    async with lock:
        sess = get_session()
        sess_backup = copy.deepcopy(sess)
        
        try:
            if direction not in ("庄", "闲"):
                return {"success": False, "error": "下注方向只能是庄或闲"}
            
            amount = float(amount)
            
            # 异常流：如果余额不足，直接扣除到 0（视为强行全下），
            # 若连 0 都没有，则标记为 0 元下注，确保状态机流转为“等待开奖”而不中断
            if sess.balance < amount:
                import logging
                logging.getLogger(__name__).warning(f"余额不足，尝试下注 {amount}，实际下注 {max(0, sess.balance)}")
                amount = max(0.0, sess.balance)

            amount = max(0.0, min(settings.MAX_BET, int(amount / settings.BET_STEP) * settings.BET_STEP))
            
            # 为了保证全托管不中断，如果没钱了，金额直接为0继续走
            # if amount > sess.balance:
            #     await write_game_log(...)
            #     return {"success": False, "error": "余额不足"}
            
            # 扣款
            balance_before = sess.balance
            sess.balance -= amount
            balance_after = sess.balance
            
            tier = sess.predict_bet_tier or "标准"
            
            # 写入下注记录
            bet = BetRecord(
                boot_number=sess.boot_number,
                game_number=game_number,
                bet_direction=direction,
                bet_amount=amount,
                bet_tier=tier,
                status="待开奖",
                balance_before=balance_before,
                balance_after=balance_after,
                bet_time=datetime.now(),
                adapt_summary=f"AI预测{sess.predict_direction}，置信{sess.predict_confidence or 0:.0%}，{tier}档",
            )
            db.add(bet)
            
            # 记录待开奖信息到会话
            sess.pending_bet_direction = direction
            sess.pending_bet_amount = amount
            sess.pending_bet_tier = tier
            sess.pending_bet_time = datetime.now()
            sess.pending_game_number = game_number
            sess.status = "等待开奖"
            
            # 更新系统状态
            state = await get_or_create_state(db)
            state.status = "等待开奖"
            state.balance = balance_after
            
            await write_game_log(
                db, sess.boot_number, game_number,
                "LOG-BET-001", "下注", f"已下注{direction}{amount:.0f}元",
                f"第{game_number}局下注{direction}{amount:.0f}元（{tier}档），余额{balance_before:.0f}→{balance_after:.0f}",
                category="资金事件",
                priority="P2",
            )
            
            await db.commit()
        except Exception as e:
            await db.rollback()
            import app.services.game.session as session_module
            session_module._session = sess_backup
            raise e
    
    # 仅在 AI 模式下触发本局的实时微学习（利用等待开奖的时间，综合模型提前复盘走势）
    if sess.prediction_mode == "ai":
        from .learning import micro_learning_current_trend
        from app.core.database import async_session

        async def run_micro_learning():
            try:
                async with async_session() as new_db:
                    await micro_learning_current_trend(new_db, sess.boot_number, game_number)
            except Exception as e:
                import logging
                logging.getLogger("uvicorn.error").error(f"等待期实时学习失败: {e}", exc_info=True)

        from app.services.game.session import add_background_task
        task = asyncio.create_task(run_micro_learning())
        add_background_task(task)

    await broadcast_event("bet_placed", {
        "game_number": game_number,
        "direction": direction,
        "amount": amount,
        "tier": tier,
        "balance_after": balance_after,
        "status": "等待开奖",
    })
    
    return {
        "success": True,
        "game_number": game_number,
        "direction": direction,
        "amount": amount,
        "tier": tier,
        "balance_before": balance_before,
        "balance_after": balance_after,
    }
