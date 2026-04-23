"""
游戏日志模块
"""
from datetime import datetime
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.schemas import SystemLog
from .session import broadcast_event


async def write_game_log(
    session: AsyncSession,
    boot_number: int,
    game_number: Optional[int],
    event_code: str,
    event_type: str,
    event_result: str,
    description: str,
    category: str = "工作流事件",
    priority: str = "P3",
    source_module: str = "ManualGameService",
) -> SystemLog:
    """写入系统日志并广播到WebSocket"""
    log = SystemLog(
        log_time=datetime.now(),
        boot_number=boot_number,
        game_number=game_number,
        event_code=event_code,
        event_type=event_type,
        event_result=event_result,
        description=description,
        category=category,
        priority=priority,
        source_module=source_module,
    )
    session.add(log)
    
    # 立即刷新以获取ID
    await session.flush()
    
    # 广播日志到WebSocket（实时推送）
    await broadcast_event("log", {
        "id": log.id,
        "log_time": log.log_time.isoformat() if log.log_time else None,
        "game_number": log.game_number,
        "event_code": log.event_code,
        "event_type": log.event_type,
        "event_result": log.event_result,
        "description": log.description,
        "category": log.category,
        "priority": log.priority,
        "is_pinned": log.is_pinned,
    })
    
    return log
