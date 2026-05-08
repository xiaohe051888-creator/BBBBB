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

    def test_repair_api_does_not_cancel_running_analysis_tasks(self):
        async def _prepare():
            from app.core.database import init_db, async_session
            from app.models.schemas import BackgroundTask
            from app.services.game.state import get_or_create_state

            await init_db()

            async with async_session() as s:
                state = await get_or_create_state(s)
                state.status = "分析中"
                s.add(
                    BackgroundTask(
                        task_id="repair-running-analysis",
                        task_type="analysis",
                        boot_number=1,
                        dedupe_key="repair-api-running-analysis",
                        status="running",
                        message="运行中",
                    )
                )
                await s.commit()
            return "repair-running-analysis"

        async def _inspect(task_id: str):
            from sqlalchemy import select
            from app.core.database import async_session
            from app.models.schemas import BackgroundTask
            from app.services.game.state import get_or_create_state

            async with async_session() as s:
                state = await get_or_create_state(s)
                row = (
                    await s.execute(
                        select(BackgroundTask).where(BackgroundTask.task_id == task_id)
                    )
                ).scalars().first()
                return state.status, row.status if row else None

        async def _call_route():
            from app.api.routes.system import repair_system
            return await repair_system(_={"sub": "admin"})

        task_id = asyncio.run(_prepare())
        res = asyncio.run(_call_route())
        self.assertTrue(res["success"])

        status, task_status = asyncio.run(_inspect(task_id))
        self.assertEqual(status, "分析中")
        self.assertEqual(task_status, "running")


if __name__ == "__main__":
    unittest.main()
