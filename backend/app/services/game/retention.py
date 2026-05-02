from datetime import datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.schemas import SystemLog, GameRecord, BetRecord


async def cleanup_logs(
    session: AsyncSession,
    now: datetime | None = None,
    hot_days: int = 7,
    warm_days: int = 30,
) -> dict:
    now = now or datetime.now()
    hot_cutoff = now - timedelta(days=int(hot_days))
    warm_cutoff = now - timedelta(days=int(warm_days))

    p3 = await session.execute(
        delete(SystemLog).where(
            SystemLog.is_pinned == False,
            SystemLog.priority == "P3",
            SystemLog.log_time < hot_cutoff,
        )
    )
    p2 = await session.execute(
        delete(SystemLog).where(
            SystemLog.is_pinned == False,
            SystemLog.priority == "P2",
            SystemLog.log_time < warm_cutoff,
        )
    )

    return {"deleted_p3": int(p3.rowcount or 0), "deleted_p2": int(p2.rowcount or 0)}


async def prune_history(session: AsyncSession, keep: int = 1000) -> dict:
    keep = int(keep)
    if keep <= 0:
        return {"deleted_game_records": 0, "deleted_bet_records": 0}

    game_ids = (await session.execute(
        select(GameRecord.id).order_by(GameRecord.boot_number.desc(), GameRecord.game_number.desc()).offset(keep)
    )).scalars().all()
    bet_ids = (await session.execute(
        select(BetRecord.id).order_by(BetRecord.created_at.desc()).offset(keep)
    )).scalars().all()

    deleted_game = 0
    deleted_bet = 0
    if game_ids:
        r = await session.execute(delete(GameRecord).where(GameRecord.id.in_(game_ids)))
        deleted_game = int(r.rowcount or 0)
    if bet_ids:
        r = await session.execute(delete(BetRecord).where(BetRecord.id.in_(bet_ids)))
        deleted_bet = int(r.rowcount or 0)

    return {"deleted_game_records": deleted_game, "deleted_bet_records": deleted_bet}
