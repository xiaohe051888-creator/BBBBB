"""
统计和走势图路由
"""
from typing import Optional
from fastapi import APIRouter, Query
from sqlalchemy import select, func, desc

from app.core.database import async_session
from app.models.schemas import GameRecord, SystemState, MistakeBook
from app.core.config import settings
from app.services.road_engine import UnifiedRoadEngine

router = APIRouter(prefix="/api", tags=["统计和走势"])


@router.get("/stats")
async def get_statistics():
    """获取统计信息"""
    async with async_session() as session:
        total_stmt = select(func.count()).select_from(
            select(GameRecord).where(
                GameRecord.predict_correct.isnot(None),
            ).subquery()
        )
        total_result = await session.execute(total_stmt)
        total_games = total_result.scalar() or 0
        
        hit_stmt = select(func.count()).select_from(
            select(GameRecord).where(
                GameRecord.predict_correct == True,
            ).subquery()
        )
        hit_result = await session.execute(hit_stmt)
        hit_count = hit_result.scalar() or 0
        
        accuracy = (hit_count / total_games * 100) if total_games > 0 else 0
        
        return {
            "total_games": total_games,
            "hit_count": hit_count,
            "miss_count": total_games - hit_count,
            "accuracy": round(accuracy, 1),
            "balance": await _get_balance(session),
        }


async def _get_balance(session) -> float:
    """获取当前余额（优先从内存获取）"""
    from app.services.manual_game_service import get_session
    sess = get_session()
    if sess.balance != settings.DEFAULT_BALANCE or sess.next_game_number > 1:
        return sess.balance
    
    stmt = select(SystemState)
    result = await session.execute(stmt)
    state = result.scalar_one_or_none()
    return state.balance if state else settings.DEFAULT_BALANCE


@router.get("/roads")
async def get_road_maps(
    boot_number: Optional[int] = Query(None),
):
    """获取五路走势图数据"""
    async with async_session() as session:
        # 获取所有记录（包括和局），用于珠盘路显示
        query = select(GameRecord).order_by(GameRecord.game_number)
        
        if boot_number is not None:
            query = query.where(GameRecord.boot_number == boot_number)
        
        result = await session.execute(query)
        records = result.scalars().all()
        
        if not records:
            return {
                "boot_number": boot_number,
                "total_games": 0,
                "roads": {
                    "大路": [],
                    "珠盘路": [],
                    "大眼仔路": [],
                    "小路": [],
                    "螳螂路": [],
                },
            }
        
        engine = UnifiedRoadEngine()
        
        # 获取错题本并设置错误标记
        stmt = select(MistakeBook).where(
            MistakeBook.boot_number == (boot_number or records[0].boot_number),
        )
        mb_result = await session.execute(stmt)
        mistakes = mb_result.scalars().all()
        error_map = {m.game_number: m.error_id for m in mistakes}
        if error_map:
            engine.set_error_marks(error_map)
        
        for r in records:
            engine.process_game(r.game_number, r.result)
        
        five_roads = engine.calculate_all_roads()
        
        def road_to_dict(road):
            return {
                "display_name": road.display_name,
                "max_columns": road.max_columns,
                "max_rows": road.max_rows,
                "points": [
                    {
                        "game_number": p.game_number,
                        "column": p.column,
                        "row": p.row,
                        "value": p.value,
                        "is_new_column": p.is_new_column,
                        "error_id": str(p.error_id) if p.error_id is not None else None,
                        "has_tie": getattr(p, 'has_tie', False),
                        "is_tie": getattr(p, 'is_tie', False),
                    }
                    for p in road.points
                ],
            }
        
        actual_boot = boot_number or (records[0].boot_number if records else 0)
        
        return {
            "boot_number": actual_boot,
            "total_games": len(records),
            "roads": {
                "大路": road_to_dict(five_roads["big_road"]),
                "珠盘路": road_to_dict(five_roads["bead_road"]),
                "大眼仔路": road_to_dict(five_roads["big_eye"]),
                "小路": road_to_dict(five_roads["small_road"]),
                "螳螂路": road_to_dict(five_roads["cockroach_road"]),
            },
        }


@router.get("/roads/raw")
async def get_road_raw_data(
    boot_number: Optional[int] = Query(None),
):
    """获取原始开奖结果列表（用于前端本地计算走势图）"""
    async with async_session() as session:
        query = select(GameRecord).order_by(GameRecord.game_number)
        
        if boot_number is not None:
            query = query.where(GameRecord.boot_number == boot_number)
        
        result = await session.execute(query)
        records = result.scalars().all()
        
        return {
            "boot_number": boot_number or (records[0].boot_number if records else 0),
            "total": len(records),
            "data": [
                {
                    "game_number": r.game_number,
                    "result": r.result,
                    "result_time": r.result_time.isoformat() if r.result_time else None,
                    "predict_direction": r.predict_direction,
                    "predict_correct": r.predict_correct,
                }
                for r in records
            ],
        }
