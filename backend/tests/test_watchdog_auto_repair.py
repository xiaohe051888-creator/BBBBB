import asyncio
import os
import sys
import unittest
from uuid import uuid4

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class WatchdogAutoRepairTest(unittest.TestCase):
    def _new_boot_number(self) -> int:
        return int(uuid4().int % 1_000_000_000) + 1000

    def test_stuck_triggers_repair_once_with_cooldown(self):
        async def _run():
            from sqlalchemy import select, delete
            from app.core.database import init_db, async_session
            from app.models.schemas import BackgroundTask, SystemLog
            from app.services.game.state import get_or_create_state
            from app.services.game.watchdog import Watchdog

            await init_db()

            async with async_session() as s:
                await s.execute(delete(BackgroundTask))
                await s.execute(delete(SystemLog).where(SystemLog.event_code == "LOG-WDG-001"))
                state = await get_or_create_state(s)
                state.boot_number = self._new_boot_number()
                state.status = "分析中"
                await s.commit()

            wd = Watchdog(
                interval_seconds=60,
                repair_cooldown_seconds=300,
                running_task_threshold=20,
                p1_error_window_seconds=600,
                p1_error_threshold=1,
            )

            async with async_session() as s:
                res1 = await wd.check_once(s, now_ts=1000.0)

            async with async_session() as s:
                res2 = await wd.check_once(s, now_ts=1100.0)
                state2 = await get_or_create_state(s)
                logs = (await s.execute(select(SystemLog).where(SystemLog.event_code == "LOG-WDG-001"))).scalars().all()

            return res1, res2, state2.status, len(logs)

        res1, res2, status, log_count = asyncio.run(_run())
        self.assertTrue(res1["did_repair"])
        self.assertFalse(res2["did_repair"])
        self.assertEqual(status, "等待开奖")
        self.assertEqual(log_count, 1)


if __name__ == "__main__":
    unittest.main()
