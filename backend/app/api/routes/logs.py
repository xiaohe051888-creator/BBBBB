"""
日志路由
"""
from typing import Optional
from fastapi import APIRouter, Query, Depends
from sqlalchemy import select, func

from app.core.database import async_session
from app.models.schemas import SystemLog
from app.api.routes.utils import get_current_user

router = APIRouter(prefix="/api/logs", tags=["系统日志"])


@router.get("")
async def get_logs(
    category: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    game_number: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    _: dict = Depends(get_current_user),
):
    """获取实盘日志（分页+筛选）"""
    async with async_session() as session:
        query = select(SystemLog)
        
        if category:
            query = query.where(SystemLog.category == category)
        if priority:
            query = query.where(SystemLog.priority == priority)
        if game_number:
            query = query.where(SystemLog.game_number == game_number)
        
        query = query.order_by(SystemLog.is_pinned.desc(), SystemLog.log_time.desc())
        
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await session.execute(count_query)
        total = total_result.scalar() or 0
        
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await session.execute(query)
        logs = result.scalars().all()
        
        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "data": [
                {
                    "id": log.id,
                    "log_time": log.log_time.isoformat() if log.log_time else None,
                    "game_number": log.game_number,
                    "event_code": log.event_code,
                    "event_type": log.event_type,
                    "event_result": log.event_result,
                    "description": log.description,
                    "category": log.category,
                    "priority": log.priority,
                    "source_module": log.source_module,
                    "event_key": log.event_key,
                    "is_pinned": log.is_pinned,
                }
                for log in logs
            ],
        }
