from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.schemas import BackgroundTask


async def recover_on_startup(db: AsyncSession) -> None:
    from app.services.game.state import get_or_create_state
    from app.services.game.logging import write_game_log
    from app.services.game.session import get_session

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
            priority="P1",
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
            priority="P1",
            source_module="startup",
        )

    if tasks or new_status != old_status:
        await db.commit()

