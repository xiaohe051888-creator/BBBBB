"""
下注记录路由
"""
from typing import Optional
from fastapi import APIRouter, Query, Depends
from sqlalchemy import select, func

from app.core.database import async_session
from app.models.schemas import BetRecord
from app.api.routes.utils import get_current_user

router = APIRouter(prefix="/api/bets", tags=["下注"])


@router.get("")
async def get_bet_records(
    boot_number: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: str = Query("bet_time", pattern="^(bet_time|game_number|bet_amount|profit_loss)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    _: dict = Depends(get_current_user),
):
    """获取下注记录（分页+筛选）"""
    async with async_session() as session:
        query = select(BetRecord)
        
        if boot_number is not None:
            query = query.where(BetRecord.boot_number == boot_number)
        
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await session.execute(count_query)
        total = total_result.scalar() or 0
        
        query = query.order_by(BetRecord.game_number.desc()).offset((page - 1) * page_size).limit(page_size)
        result = await session.execute(query)
        records = result.scalars().all()
        
        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "data": [
                {
                    "game_number": r.game_number,
                    "bet_time": r.bet_time.isoformat() if r.bet_time else None,
                    "bet_direction": r.bet_direction,
                    "bet_amount": r.bet_amount,
                    "bet_tier": r.bet_tier,
                    "status": r.status,
                    "game_result": r.game_result,
                    "error_id": r.error_id,
                    "settlement_amount": r.settlement_amount,
                    "profit_loss": r.profit_loss,
                    "balance_before": r.balance_before,
                    "balance_after": r.balance_after,
                    "adapt_summary": r.adapt_summary,
                }
                for r in records
            ],
        }
