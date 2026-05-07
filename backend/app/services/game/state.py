"""
游戏状态管理模块
"""
from typing import Dict, Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.models.schemas import SystemState
from .session import get_session, get_session_lock
from app.services.startup_state import build_startup_session_seed


async def get_or_create_state(db: AsyncSession) -> SystemState:
    """获取或创建系统状态记录"""
    stmt = select(SystemState).where(SystemState.singleton_key == 1).with_for_update()
    result = await db.execute(stmt)
    state = result.scalar_one_or_none()
    
    if not state:
        state = SystemState(
            singleton_key=1,
            status="空闲",
            balance=settings.DEFAULT_BALANCE,
            boot_number=1,
            game_number=0,
            prediction_mode="rule",
        )
        db.add(state)
        await db.flush()
    
    return state


async def get_current_state() -> Dict[str, Any]:
    """获取当前游戏状态（内存态）"""
    lock = get_session_lock()
    async with lock:
        sess = get_session()
        return {
            "status": sess.status,
            "prediction_mode": sess.prediction_mode,
            "boot_number": sess.boot_number,
            "next_game_number": sess.next_game_number,
            "predict_direction": sess.predict_direction,
            "predict_confidence": sess.predict_confidence,
            "predict_bet_tier": sess.predict_bet_tier,
            "predict_bet_amount": sess.predict_bet_amount,
            "pending_bet": {
                "direction": sess.pending_bet_direction,
                "amount": sess.pending_bet_amount,
                "tier": sess.pending_bet_tier,
                "game_number": sess.pending_game_number,
                "time": sess.pending_bet_time.isoformat() if sess.pending_bet_time else None,
            } if sess.pending_bet_direction else None,
            "balance": sess.balance,
            "consecutive_errors": sess.consecutive_errors,
            "analysis": {
                "banker_summary": sess.banker_summary,
                "player_summary": sess.player_summary,
                "combined_summary": sess.combined_summary,
                "combined_reasoning_points": sess.combined_reasoning_points,
                "combined_reasoning_detail": sess.combined_reasoning_detail,
                "engine": sess.analysis_engine,
                "time": sess.analysis_time.isoformat() if sess.analysis_time else None,
            } if sess.combined_summary else None,
        }


async def sync_balance_from_db(db: AsyncSession):
    """从数据库同步余额到内存会话（重启后恢复）"""
    from app.models.schemas import GameRecord
    
    stmt = select(SystemState).where(SystemState.singleton_key == 1)
    result = await db.execute(stmt)
    state = result.scalar_one_or_none()
    
    if state:
        lock = get_session_lock()
        async with lock:
            sess = get_session()

            # 恢复下一局号
            stmt2 = select(GameRecord.game_number).where(
                GameRecord.boot_number == (state.boot_number or 1),
            ).order_by(GameRecord.game_number.desc()).limit(1)
            r2 = await db.execute(stmt2)
            max_game = r2.scalar_one_or_none()
            seed = build_startup_session_seed(state, max_game_number=max_game)
            sess.balance = float(seed["balance"])
            sess.boot_number = int(seed["boot_number"])
            sess.next_game_number = int(seed["next_game_number"])
            sess.consecutive_errors = int(seed["consecutive_errors"])
            sess.prediction_mode = str(seed["prediction_mode"])
