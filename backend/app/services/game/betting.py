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
from .state_machine import can_place_bet
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
    if game_number > 72:
        return {"success": False, "error": "单靴最多支持 72 局，本靴已满，请新开一靴"}

    lock = get_session_lock()
    async with lock:
        sess = get_session()
        sess_backup = copy.deepcopy(sess)
        
        try:
            if direction not in ("庄", "闲"):
                return {"success": False, "error": "下注方向只能是庄或闲"}
            
            import math
            amount = float(amount)
            if math.isnan(amount) or math.isinf(amount) or amount < 0:
                return {"success": False, "error": "非法的下注金额"}

            existing = (await db.execute(
                select(BetRecord)
                .where(
                    BetRecord.boot_number == sess.boot_number,
                    BetRecord.game_number == game_number,
                )
                .order_by(BetRecord.bet_seq.desc())
                .limit(1)
            )).scalars().first()
            if existing:
                if existing.status == "待开奖":
                    sess.pending_bet_direction = existing.bet_direction
                    sess.pending_bet_amount = float(existing.bet_amount)
                    sess.pending_bet_tier = existing.bet_tier
                    sess.pending_bet_time = existing.bet_time
                    sess.pending_game_number = existing.game_number
                    sess.status = "等待开奖"
                    return {
                        "success": True,
                        "game_number": existing.game_number,
                        "direction": existing.bet_direction,
                        "amount": float(existing.bet_amount),
                        "tier": existing.bet_tier,
                        "balance_before": float(existing.balance_before),
                        "balance_after": float(existing.balance_after),
                    }
                return {"success": False, "error": "该局已存在下注记录，不能重复下注"}

            if not can_place_bet(sess.status):
                return {"success": False, "error": "illegal_state", "message": f"当前状态({sess.status})无法下注"}
                
            amount = max(settings.MIN_BET, min(settings.MAX_BET, int(amount / settings.BET_STEP) * settings.BET_STEP))
            
            # 余额不足时：停止下注动作，返回明确错误，并将系统挂起为“余额不足”状态
            if amount > sess.balance:
                await write_game_log(
                    db, sess.boot_number, game_number,
                    "LOG-BET-ERR", "下注失败", "余额不足",
                    f"第{game_number}局下注{direction}{amount:.2f}元失败，当前余额{sess.balance:.2f}元",
                    category="资金事件",
                    priority="P2",
                )
                
                sess.status = "余额不足"
                state = await get_or_create_state(db)
                state.status = "余额不足"
                await db.commit()
                await broadcast_event("state_update", {"status": "余额不足"})
                
                return {"success": False, "error": f"余额不足，当前余额{sess.balance:.2f}，下注{amount:.2f}"}
            
            # 扣款
            balance_before = sess.balance
            sess.balance = round(sess.balance - amount, 2)
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
            state.current_bet_tier = sess.pending_bet_tier
            
            await write_game_log(
                db, sess.boot_number, game_number,
                "LOG-BET-001", "下注", f"已下注{direction}{amount:.2f}元",
                f"第{game_number}局下注{direction}{amount:.2f}元（{tier}档），余额{balance_before:.2f}→{balance_after:.2f}",
                category="资金事件",
                priority="P2",
            )
            
            await db.commit()
        except Exception as e:
            await db.rollback()
            import app.services.game.session as session_module
            session_module._session = sess_backup
            raise e
    
    if sess.prediction_mode in ("ai", "single_ai"):
        from .learning import micro_learning_current_trend
        from app.core.database import async_session

        async def run_micro_learning():
            try:
                async with async_session() as new_db:
                    await micro_learning_current_trend(new_db, sess.boot_number, game_number, prediction_mode=sess.prediction_mode)
            except Exception as e:
                import logging
                logging.getLogger("uvicorn.error").error(f"等待期实时学习失败: {e}", exc_info=True)

        from app.services.game.session import start_background_task
        start_background_task("micro_learning", run_micro_learning())

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
