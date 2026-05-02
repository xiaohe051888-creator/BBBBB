from datetime import datetime, timedelta

from sqlalchemy import and_, delete, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.schemas import AIMemory, BetRecord, GameRecord, MistakeBook, RoadMap, SystemLog


def _tier_for_priority(priority: str) -> str:
    if priority == "P1":
        return "cold_perm"
    if priority == "P2":
        return "warm30"
    return "hot7"


async def normalize_log_priorities(session: AsyncSession) -> dict:
    mappings: dict[str, str] = {
        "LOG-SYS-003": "P2",
        "LOG-STL-001": "P2",
        "LOG-BOOT-001": "P2",
        "LOG-BOOT-002": "P2",
        "LOG-BOOT-004": "P2",
        "LOG-RECOVER-001": "P2",
        "LOG-RECOVER-002": "P2",
        "LOG-RECOVER-003": "P2",
        "LOG-WDG-001": "P2",
        "LOG-WDG-003": "P2",
    }

    updated = 0
    for code, new_priority in mappings.items():
        new_tier = _tier_for_priority(new_priority)
        r = await session.execute(
            update(SystemLog)
            .where(SystemLog.event_code == code)
            .values(priority=new_priority, retention_tier=new_tier)
        )
        updated += int(r.rowcount or 0)

    return {"updated": updated}


async def cleanup_logs(
    session: AsyncSession,
    now: datetime | None = None,
    hot_days: int = 7,
    warm_days: int = 30,
) -> dict:
    now = now or datetime.now()
    normalized = await normalize_log_priorities(session)
    hot_cutoff = now - timedelta(days=int(hot_days))
    warm_cutoff = now - timedelta(days=int(warm_days))

    p3 = await session.execute(
        delete(SystemLog).where(
            SystemLog.is_pinned == False,
            SystemLog.retention_tier == "hot7",
            SystemLog.log_time < hot_cutoff,
        )
    )
    p2 = await session.execute(
        delete(SystemLog).where(
            SystemLog.is_pinned == False,
            SystemLog.retention_tier == "warm30",
            SystemLog.log_time < warm_cutoff,
        )
    )

    return {
        "normalized": normalized,
        "deleted_p3": int(p3.rowcount or 0),
        "deleted_p2": int(p2.rowcount or 0),
    }


async def prune_history(session: AsyncSession, keep: int = 1000) -> dict:
    keep = int(keep)
    if keep <= 0:
        return {
            "deleted_game_records": 0,
            "deleted_bet_records": 0,
            "deleted_road_maps": 0,
            "deleted_mistake_book": 0,
            "deleted_ai_memories": 0,
        }

    boundary = (
        await session.execute(
            select(GameRecord.boot_number, GameRecord.game_number)
            .order_by(GameRecord.boot_number.desc(), GameRecord.game_number.desc())
            .offset(keep - 1)
            .limit(1)
        )
    ).first()
    if not boundary:
        return {
            "deleted_game_records": 0,
            "deleted_bet_records": 0,
            "deleted_road_maps": 0,
            "deleted_mistake_book": 0,
            "deleted_ai_memories": 0,
        }
    boundary_boot, boundary_game = int(boundary[0]), int(boundary[1])

    def _older_than_boundary(model):
        return or_(
            model.boot_number < boundary_boot,
            and_(model.boot_number == boundary_boot, model.game_number < boundary_game),
        )

    deleted_game = 0
    deleted_bet = 0
    deleted_road = 0
    deleted_mistake = 0
    deleted_mem = 0

    r = await session.execute(delete(RoadMap).where(_older_than_boundary(RoadMap)))
    deleted_road = int(r.rowcount or 0)
    r = await session.execute(delete(MistakeBook).where(_older_than_boundary(MistakeBook)))
    deleted_mistake = int(r.rowcount or 0)
    r = await session.execute(delete(AIMemory).where(_older_than_boundary(AIMemory)))
    deleted_mem = int(r.rowcount or 0)
    r = await session.execute(delete(BetRecord).where(_older_than_boundary(BetRecord)))
    deleted_bet = int(r.rowcount or 0)
    r = await session.execute(delete(GameRecord).where(_older_than_boundary(GameRecord)))
    deleted_game = int(r.rowcount or 0)

    return {
        "deleted_game_records": deleted_game,
        "deleted_bet_records": deleted_bet,
        "deleted_road_maps": deleted_road,
        "deleted_mistake_book": deleted_mistake,
        "deleted_ai_memories": deleted_mem,
    }
