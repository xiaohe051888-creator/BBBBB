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
from .session import get_session, broadcast_event
from .state import get_or_create_state
from .logging import write_game_log


async def place_bet(
    db: AsyncSession,
    game_number: int,
    direction: str,
    amount: float,
) -> Dict[str, Any]:
    """
    下注 - 在指定局上下注
    
    Args:
        game_number: 下注局号
        direction: "庄" 或 "闲"
        amount: 下注金额
    """
    sess = get_session()
    
    if direction not in ("庄", "闲"):
        return {"success": False, "error": "下注方向只能是庄或闲"}
    
    amount = float(amount)
    amount = max(settings.MIN_BET, min(settings.MAX_BET, int(amount / settings.BET_STEP) * settings.BET_STEP))
    
    if amount > sess.balance:
        await write_game_log(
            db, sess.boot_number, game_number,
            "LOG-BET-ERR", "下注失败", "余额不足",
            f"第{game_number}局下注{direction}{amount:.0f}元失败，当前余额{sess.balance:.0f}元",
            category="资金事件",
            priority="P2",
        )
        await db.commit()
        return {"success": False, "error": f"余额不足，当前余额{sess.balance:.0f}，下注{amount:.0f}"}
    
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
    
    # 触发上一局的微学习（利用等待开奖的时间）
    # 注意：创建新任务时使用新的数据库会话，避免会话状态冲突
    if game_number > 1:
        from .learning import micro_learning_previous_game
        from app.core.database import async_session
        
        async def run_micro_learning():
            async with async_session() as new_db:
                await micro_learning_previous_game(new_db, sess.boot_number, game_number - 1)
        
        asyncio.create_task(run_micro_learning())
    
    await broadcast_event("bet_placed", {
        "game_number": game_number,
        "direction": direction,
        "amount": amount,
        "tier": tier,
        "balance_after": balance_after,
        "status": "等待开奖",
        "micro_learning": "进行中" if game_number > 1 else "无上一局",
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
