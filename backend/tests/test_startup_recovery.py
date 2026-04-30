import asyncio
import os
import sys
import unittest
from uuid import uuid4

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class StartupRecoveryTest(unittest.TestCase):
    def test_recover_on_startup_cancels_running_tasks_and_resets_status(self):
        async def _run():
            from sqlalchemy import select
            from app.core.database import init_db, async_session
            from app.models.schemas import BackgroundTask, SystemLog
            from app.services.game.state import get_or_create_state
            from app.services.game.recovery import recover_on_startup

            await init_db()

            async with async_session() as s:
                state = await get_or_create_state(s)
                state.status = "分析中"
                task_id = str(uuid4())
                s.add(BackgroundTask(
                    task_id=task_id,
                    task_type="analysis",
                    boot_number=1,
                    dedupe_key="test",
                    status="running",
                    message="运行中",
                ))
                await s.commit()

            async with async_session() as s:
                await recover_on_startup(s)

            async with async_session() as s:
                state2 = await get_or_create_state(s)
                task2 = (await s.execute(select(BackgroundTask).where(BackgroundTask.task_id == task_id))).scalars().first()
                logs = (await s.execute(select(SystemLog).where(SystemLog.event_code.in_(["LOG-RECOVER-001", "LOG-RECOVER-002"])))).scalars().all()
                return state2.status, task2.status if task2 else None, len(logs)

        status, task_status, log_count = asyncio.run(_run())
        self.assertEqual(status, "等待开奖")
        self.assertEqual(task_status, "cancelled")
        self.assertGreaterEqual(log_count, 1)


if __name__ == "__main__":
    unittest.main()
