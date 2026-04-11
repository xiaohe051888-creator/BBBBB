"""
游戏上传模块 - 处理批量开奖记录上传
"""
from datetime import datetime
from typing import Dict, Any, Optional, List

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.core.config import settings
from app.models.schemas import GameRecord, BetRecord, SystemLog
from .session import get_session, broadcast_event, clear_session
from .state import get_or_create_state
from .logging import write_game_log


async def _reset_table_data(db: AsyncSession, table_id: str) -> None:
    """
    重置桌子数据 - 清空该桌的所有历史记录
    这是上传新数据的必要步骤，防止数据错乱
    """
    # 删除该桌的所有游戏记录
    await db.execute(
        delete(GameRecord).where(GameRecord.table_id == table_id)
    )
    # 删除该桌的所有下注记录
    await db.execute(
        delete(BetRecord).where(BetRecord.table_id == table_id)
    )
    # 删除该桌的系统日志（保留最近100条用于审计）
    await db.execute(
        delete(SystemLog).where(SystemLog.table_id == table_id)
    )
    await db.flush()


async def _reset_session_state(table_id: str) -> None:
    """
    重置会话状态 - 清理内存中的工作流状态
    """
    sess = get_session(table_id)
    
    # 重置所有状态
    sess.status = "空闲"
    sess.predict_direction = None
    sess.predict_confidence = None
    sess.predict_bet_tier = None
    sess.predict_bet_amount = None
    
    # 清理待处理的下注
    sess.pending_bet_direction = None
    sess.pending_bet_amount = None
    sess.pending_bet_tier = None
    sess.pending_bet_time = None
    sess.pending_game_number = None
    
    # 重置统计
    sess.balance = settings.DEFAULT_BALANCE
    sess.consecutive_errors = 0
    
    # 清理AI分析缓存
    sess.banker_summary = None
    sess.player_summary = None
    sess.combined_summary = None
    sess.analysis_time = None
    sess.deep_learning_status = None


async def upload_games(
    db: AsyncSession,
    table_id: str,
    games: List[Dict[str, Any]],
    boot_number: Optional[int] = None,
) -> Dict[str, Any]:
    """
    上传批量开奖记录
    
    ⚠️ 重要：上传新数据会重置该桌的所有历史数据和工作流状态！
    
    Args:
        games: [{game_number: int, result: "庄"/"闲"/"和"}, ...]
        boot_number: 靴号，None则自动推断
    
    Returns:
        {"success": True, "uploaded": N, "boot_number": X, "next_game_number": Y}
    """
    sess = get_session(table_id)
    
    if not games:
        await write_game_log(
            db, table_id, 0, None,
            "LOG-VAL-001", "参数校验", "失败",
            "批量上传失败：上传数据为空",
            priority="P2",
        )
        await db.commit()
        return {"success": False, "error": "上传数据为空"}
    
    # 记录重置前的状态（用于日志）
    old_status = sess.status
    old_boot = sess.boot_number
    
    # ========== 步骤1：重置数据 ==========
    # 清空该桌的所有历史数据，防止数据错乱
    await _reset_table_data(db, table_id)
    
    # ========== 步骤2：重置会话状态 ==========
    # 清理内存中的工作流状态，终止所有进行中的操作
    await _reset_session_state(table_id)
    
    # 推断靴号：取现有最大靴号，或使用传入值
    if boot_number is None:
        stmt = select(GameRecord.boot_number).where(
            GameRecord.table_id == table_id
        ).order_by(GameRecord.boot_number.desc()).limit(1)
        result = await db.execute(stmt)
        existing_boot = result.scalar_one_or_none()
        boot_number = (existing_boot or 0) + 1
    
    sess.boot_number = boot_number
    
    uploaded = 0
    for g in games:
        game_number = g["game_number"]
        result_val = g["result"]
        
        # 检查是否已存在（避免重复）
        stmt = select(GameRecord).where(
            GameRecord.table_id == table_id,
            GameRecord.boot_number == boot_number,
            GameRecord.game_number == game_number,
        )
        check = await db.execute(stmt)
        existing = check.scalar_one_or_none()
        
        if existing:
            # 更新结果
            existing.result = result_val
            existing.result_time = datetime.now()
        else:
            record = GameRecord(
                table_id=table_id,
                boot_number=boot_number,
                game_number=game_number,
                result=result_val,
                result_time=datetime.now(),
            )
            db.add(record)
        uploaded += 1
    
    await db.flush()
    
    # 计算下一局号
    max_game = max(g["game_number"] for g in games)
    sess.next_game_number = max_game + 1
    sess.status = "分析中"
    
    # 更新系统状态
    state = await get_or_create_state(db, table_id)
    state.status = "分析中"
    state.boot_number = boot_number
    state.game_number = max_game
    state.balance = sess.balance
    
    # 记录重置日志
    if old_status != "空闲":
        await write_game_log(
            db, table_id, boot_number, 0,
            "LOG-SYS-003", "系统重置", "成功",
            f"上传新数据触发重置：原状态[{old_status}]靴号[{old_boot}]已清理",
            priority="P1",
        )
    
    await write_game_log(
        db, table_id, boot_number, max_game,
        "LOG-MNL-001", "批量上传", "成功",
        f"上传第{games[0]['game_number']}~{max_game}局共{uploaded}条记录，靴号{boot_number}，数据已重置",
        priority="P2",
    )
    
    await db.commit()
    
    # 广播状态更新
    await broadcast_event(table_id, "state_update", {
        "status": "分析中",
        "boot_number": boot_number,
        "game_number": max_game,
        "uploaded": uploaded,
    })
    
    return {
        "success": True,
        "uploaded": uploaded,
        "boot_number": boot_number,
        "max_game_number": max_game,
        "next_game_number": sess.next_game_number,
    }
