import os
import time
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select

from app.api.routes.utils import get_current_user
from app.core.config import settings
from app.core.database import async_session
from app.models.schemas import BetRecord, GameRecord, SystemLog
from app.services.game.logging import write_game_log
from app.services.game.retention import cleanup_logs, prune_history
from app.services.game.state import get_or_create_state

router = APIRouter(prefix="/api/admin/maintenance", tags=["系统维护"])


def _sqlite_db_size_bytes() -> int | None:
    url = settings.DATABASE_URL
    if not url.startswith("sqlite"):
        return None
    if "///" not in url:
        return None
    path = url.split("///", 1)[1].split("?", 1)[0]
    if not path:
        return None
    if not os.path.isabs(path):
        path = os.path.abspath(os.path.join(os.getcwd(), path))
    try:
        return int(os.path.getsize(path))
    except Exception:
        return None


@router.get("/stats")
async def maintenance_stats(_: dict = Depends(get_current_user)):
    async with async_session() as session:
        log_total = (await session.execute(select(func.count()).select_from(SystemLog))).scalar() or 0
        log_pinned = (await session.execute(select(func.count()).select_from(SystemLog).where(SystemLog.is_pinned == True))).scalar() or 0
        log_p1 = (await session.execute(select(func.count()).select_from(SystemLog).where(SystemLog.priority == "P1"))).scalar() or 0
        log_p2 = (await session.execute(select(func.count()).select_from(SystemLog).where(SystemLog.priority == "P2"))).scalar() or 0
        log_p3 = (await session.execute(select(func.count()).select_from(SystemLog).where(SystemLog.priority == "P3"))).scalar() or 0

        game_total = (await session.execute(select(func.count()).select_from(GameRecord))).scalar() or 0
        bet_total = (await session.execute(select(func.count()).select_from(BetRecord))).scalar() or 0

        last_ret = (await session.execute(
            select(SystemLog.log_time).where(SystemLog.event_code == "LOG-MAINT-RET").order_by(SystemLog.log_time.desc()).limit(1)
        )).scalar_one_or_none()

        return {
            "counts": {
                "system_logs_total": int(log_total),
                "system_logs_pinned": int(log_pinned),
                "system_logs_p1": int(log_p1),
                "system_logs_p2": int(log_p2),
                "system_logs_p3": int(log_p3),
                "game_records_total": int(game_total),
                "bet_records_total": int(bet_total),
            },
            "config": {
                "RETENTION_ENABLED": bool(settings.RETENTION_ENABLED),
                "RETENTION_INTERVAL_SECONDS": int(settings.RETENTION_INTERVAL_SECONDS),
                "LOG_RETENTION_HOT": int(settings.LOG_RETENTION_HOT),
                "LOG_RETENTION_WARM": int(settings.LOG_RETENTION_WARM),
                "MAX_HISTORY_RECORDS": int(settings.MAX_HISTORY_RECORDS),
            },
            "sqlite_size_bytes": _sqlite_db_size_bytes(),
            "last_manual_retention_at": last_ret.isoformat() if last_ret else None,
        }


@router.get("/alerts")
async def maintenance_alerts(
    hours: int = Query(24, ge=1, le=168),
    limit: int = Query(20, ge=1, le=100),
    _: dict = Depends(get_current_user),
):
    cutoff = datetime.now() - timedelta(hours=int(hours))
    async with async_session() as session:
        q = (
            select(SystemLog)
            .where(SystemLog.priority == "P1", SystemLog.log_time >= cutoff)
            .order_by(SystemLog.log_time.desc())
            .limit(int(limit))
        )
        logs = (await session.execute(q)).scalars().all()
        return {
            "count": len(logs),
            "data": [
                {
                    "id": log.id,
                    "log_time": log.log_time.isoformat() if log.log_time else None,
                    "boot_number": log.boot_number,
                    "game_number": log.game_number,
                    "event_code": log.event_code,
                    "event_type": log.event_type,
                    "event_result": log.event_result,
                    "description": log.description,
                    "category": log.category,
                    "priority": log.priority,
                    "source_module": log.source_module,
                    "task_id": log.task_id,
                }
                for log in logs
            ],
        }


@router.post("/retention/run")
async def maintenance_retention_run(_: dict = Depends(get_current_user)):
    started = time.perf_counter()
    async with async_session() as session:
        now = datetime.now()
        deleted_logs = await cleanup_logs(
            session,
            now=now,
            hot_days=settings.LOG_RETENTION_HOT,
            warm_days=settings.LOG_RETENTION_WARM,
        )
        deleted_history = await prune_history(session, keep=settings.MAX_HISTORY_RECORDS)
        state = await get_or_create_state(session)
        await write_game_log(
            session,
            boot_number=state.boot_number or 0,
            game_number=state.game_number or 0,
            event_code="LOG-MAINT-RET",
            event_type="Maintenance",
            event_result="OK",
            description=f"手动清理完成：logs(p3={deleted_logs['deleted_p3']}, p2={deleted_logs['deleted_p2']}), history(game={deleted_history['deleted_game_records']}, bet={deleted_history['deleted_bet_records']})",
            category="系统维护",
            priority="P2",
            source_module="maintenance",
        )
        await session.commit()

    elapsed_ms = int((time.perf_counter() - started) * 1000)
    return {
        "deleted": {
            **deleted_logs,
            **deleted_history,
        },
        "elapsed_ms": elapsed_ms,
    }

