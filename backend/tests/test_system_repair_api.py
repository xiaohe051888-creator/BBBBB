import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class SystemRepairApiTest(unittest.TestCase):
    def test_repair_stuck_state_resets_analysis_without_running_task(self):
        async def _run():
            from sqlalchemy import select, delete
            from app.core.database import init_db, async_session
            from app.models.schemas import BackgroundTask, SystemLog
            from app.services.game.state import get_or_create_state
            from app.services.game.recovery import repair_stuck_state

            await init_db()

            async with async_session() as s:
                await s.execute(delete(BackgroundTask))
                state = await get_or_create_state(s)
                state.status = "分析中"
                await s.commit()

            async with async_session() as s:
                res = await repair_stuck_state(s)

            async with async_session() as s:
                state2 = await get_or_create_state(s)
                logs = (await s.execute(select(SystemLog).where(SystemLog.event_code == "LOG-RECOVER-003"))).scalars().all()
                return res, state2.status, len(logs)

        res, status, log_count = asyncio.run(_run())
        self.assertTrue(res["repaired"])
        self.assertEqual(status, "等待开奖")
        self.assertGreaterEqual(log_count, 1)


if __name__ == "__main__":
    unittest.main()

