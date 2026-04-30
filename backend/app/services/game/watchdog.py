import asyncio
from dataclasses import dataclass

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass
class Watchdog:
    interval_seconds: int
    repair_cooldown_seconds: int
    running_task_threshold: int
    p1_error_window_seconds: int
    p1_error_threshold: int
    _last_repair_ts: float | None = None
    _last_backlog_alert_ts: float | None = None
    _last_p1_alert_ts: float | None = None

    async def check_once(self, db: AsyncSession, now_ts: float | None = None) -> dict:
        from datetime import datetime, timedelta
        from app.models.schemas import BackgroundTask, SystemLog
        from app.services.game.recovery import detect_stuck_state, repair_stuck_state
        from app.services.game.logging import write_game_log
        from app.services.game.state import get_or_create_state

        now = datetime.now()
        now_ts = float(now_ts) if now_ts is not None else now.timestamp()

        running_count = (await db.execute(
            select(func.count()).select_from(BackgroundTask).where(BackgroundTask.status == "running")
        )).scalar() or 0

        p1_since = now - timedelta(seconds=self.p1_error_window_seconds)
        p1_count = (await db.execute(
            select(func.count()).select_from(SystemLog).where(
                SystemLog.priority == "P1",
                SystemLog.log_time >= p1_since,
                or_(SystemLog.source_module.is_(None), SystemLog.source_module != "watchdog"),
            )
        )).scalar() or 0

        stuck_info = await detect_stuck_state(db)
        did_repair = False

        if stuck_info.get("stuck"):
            can_repair = self._last_repair_ts is None or (now_ts - self._last_repair_ts) >= self.repair_cooldown_seconds
            if can_repair:
                state_before = await get_or_create_state(db)
                old_status = state_before.status
                repaired = await repair_stuck_state(db)
                did_repair = bool(repaired.get("repaired"))
                if did_repair:
                    self._last_repair_ts = now_ts
                    state_after = await get_or_create_state(db)
                    await write_game_log(
                        db,
                        boot_number=state_after.boot_number or 0,
                        game_number=state_after.game_number or 0,
                        event_code="LOG-WDG-001",
                        event_type="Watchdog",
                        event_result="AutoRepair",
                        description=f"自动修复卡住状态：{old_status} → {state_after.status}",
                        category="系统事件",
                        priority="P1",
                        source_module="watchdog",
                    )
                    await db.commit()

        if running_count > self.running_task_threshold:
            can_alert = self._last_backlog_alert_ts is None or (now_ts - self._last_backlog_alert_ts) >= self.repair_cooldown_seconds
            if can_alert:
                self._last_backlog_alert_ts = now_ts
                state = await get_or_create_state(db)
                await write_game_log(
                    db,
                    boot_number=state.boot_number or 0,
                    game_number=state.game_number or 0,
                    event_code="LOG-WDG-002",
                    event_type="Watchdog",
                    event_result="Alert",
                    description=f"后台任务积压告警：running={running_count}",
                    category="系统事件",
                    priority="P1",
                    source_module="watchdog",
                )
                await db.commit()

        if p1_count >= self.p1_error_threshold:
            can_alert = self._last_p1_alert_ts is None or (now_ts - self._last_p1_alert_ts) >= self.repair_cooldown_seconds
            if can_alert:
                self._last_p1_alert_ts = now_ts
                state = await get_or_create_state(db)
                await write_game_log(
                    db,
                    boot_number=state.boot_number or 0,
                    game_number=state.game_number or 0,
                    event_code="LOG-WDG-003",
                    event_type="Watchdog",
                    event_result="Alert",
                    description=f"最近{self.p1_error_window_seconds}s P1错误告警：count={p1_count}",
                    category="系统事件",
                    priority="P1",
                    source_module="watchdog",
                )
                await db.commit()

        return {
            "did_repair": did_repair,
            "stuck": bool(stuck_info.get("stuck")),
            "running_count": int(running_count),
            "p1_error_count": int(p1_count),
        }

    async def run_forever(self) -> None:
        from app.core.database import async_session
        from app.core.async_utils import spawn_task

        while True:
            try:
                async with async_session() as s:
                    await self.check_once(s)
            except asyncio.CancelledError:
                raise
            except Exception:
                spawn_task(self._report_internal_error(), name="watchdog_internal_error")
            await asyncio.sleep(self.interval_seconds)

    async def _report_internal_error(self) -> None:
        from app.core.database import async_session
        from app.services.game.logging import write_game_log

        async with async_session() as s:
            await write_game_log(
                s,
                boot_number=0,
                game_number=None,
                event_code="LOG-WDG-ERR",
                event_type="Watchdog",
                event_result="Exception",
                description="Watchdog 执行异常（详见后端日志）",
                category="系统异常",
                priority="P1",
                source_module="watchdog",
            )
            await s.commit()
