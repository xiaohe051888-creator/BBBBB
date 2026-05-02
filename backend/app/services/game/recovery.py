from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.schemas import BackgroundTask


async def detect_stuck_state(db: AsyncSession) -> dict:
    from app.models.schemas import SystemState
    from app.services.game.session import list_background_tasks

    state = (await db.execute(select(SystemState).order_by(SystemState.id.desc()).limit(1))).scalars().first()
    status = state.status if state else None
    expected_task_type = None
    safe_status = None

    if status == "分析中":
        expected_task_type = "analysis"
        safe_status = "等待开奖"
    elif status == "深度学习中":
        expected_task_type = "deep_learning"
        safe_status = "等待新靴"

    if not expected_task_type:
        return {"stuck": False, "status": status, "expected_task_type": None}

    mem_tasks = list_background_tasks(limit=200)
    mem_running = [
        t
        for t in mem_tasks
        if t.get("status") == "running" and t.get("task_type") == expected_task_type
    ]

    running = (await db.execute(
        select(BackgroundTask).where(
            BackgroundTask.status == "running",
            BackgroundTask.task_type == expected_task_type,
        )
    )).scalars().all()

    return {
        "stuck": len(running) == 0 and len(mem_running) == 0,
        "status": status,
        "expected_task_type": expected_task_type,
        "safe_status": safe_status,
        "db_running_count": len(running),
        "mem_running_count": len(mem_running),
    }


async def repair_stuck_state(db: AsyncSession) -> dict:
    from app.services.game.state import get_or_create_state
    from app.services.game.logging import write_game_log
    from app.services.game.session import get_session, get_session_lock

    info = await detect_stuck_state(db)
    if not info.get("stuck"):
        return {"repaired": False, "detail": info}

    state = await get_or_create_state(db)
    old_status = state.status
    new_status = info.get("safe_status") or old_status
    state.status = new_status

    lock = get_session_lock()
    async with lock:
        mem = get_session()
        mem.status = new_status

    await write_game_log(
        db,
        boot_number=state.boot_number or 0,
        game_number=state.game_number or 0,
        event_code="LOG-RECOVER-003",
        event_type="系统修复",
        event_result="回落卡住状态",
        description=f"检测到状态{old_status}卡住（无对应 running 任务），已回落为 {new_status}",
        category="系统事件",
        priority="P2",
        source_module="repair",
    )

    await db.commit()
    return {"repaired": True, "from": old_status, "to": new_status}


async def recover_on_startup(db: AsyncSession) -> None:
    from app.services.game.state import get_or_create_state
    from app.services.game.logging import write_game_log
    from app.services.game.session import get_session, get_session_lock

    tasks = (await db.execute(select(BackgroundTask).where(BackgroundTask.status == "running"))).scalars().all()
    if tasks:
        now = datetime.now()
        for t in tasks:
            t.status = "cancelled"
            t.message = "服务重启自动取消"
            t.finished_at = now

        state = await get_or_create_state(db)
        await write_game_log(
            db,
            boot_number=state.boot_number or 0,
            game_number=state.game_number or 0,
            event_code="LOG-RECOVER-001",
            event_type="系统恢复",
            event_result="取消后台任务",
            description=f"服务重启自动取消未完成后台任务 {len(tasks)} 个",
            category="系统事件",
            priority="P2",
            source_module="startup",
        )

    state = await get_or_create_state(db)
    old_status = state.status
    new_status = old_status
    if old_status == "分析中":
        new_status = "等待开奖"
    elif old_status == "深度学习中":
        new_status = "等待新靴"

    if new_status != old_status:
        state.status = new_status
        lock = get_session_lock()
        async with lock:
            mem = get_session()
            mem.status = new_status
        await write_game_log(
            db,
            boot_number=state.boot_number or 0,
            game_number=state.game_number or 0,
            event_code="LOG-RECOVER-002",
            event_type="系统恢复",
            event_result="回落状态",
            description=f"服务重启恢复：状态 {old_status} → {new_status}",
            category="系统事件",
            priority="P2",
            source_module="startup",
        )

    if tasks or new_status != old_status:
        await db.commit()
