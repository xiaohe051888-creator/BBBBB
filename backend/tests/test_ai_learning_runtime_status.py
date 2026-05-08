import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class AiLearningRuntimeStatusTest(unittest.TestCase):
    def test_status_endpoint_reads_running_registry_task(self):
        async def _run():
            from app.api.routes.analysis import get_ai_learning_status
            from app.services.ai_learning_service import AILearningService
            from app.services.game.session import start_background_task

            release = asyncio.Event()

            async def job():
                await release.wait()

            meta = start_background_task(
                "ai_learning",
                job(),
                boot_number=3,
                dedupe_key="ai-learning-status-endpoint",
            )
            await asyncio.sleep(0.05)

            AILearningService._is_learning = False
            AILearningService._current_task = None
            status = await get_ai_learning_status(_={"sub": "admin"})

            release.set()
            await meta.task
            return meta.task_id, status

        task_id, status = asyncio.run(_run())
        self.assertTrue(status["is_learning"])
        self.assertEqual(status["current_task"], task_id)

    def test_detect_stuck_state_accepts_ai_learning_task_for_learning_status(self):
        async def _run():
            from app.core.database import init_db, async_session
            from app.services.game.recovery import detect_stuck_state
            from app.services.game.session import start_background_task, get_session
            from app.services.game.state import get_or_create_state

            await init_db()

            release = asyncio.Event()

            async def job():
                await release.wait()

            meta = start_background_task(
                "ai_learning",
                job(),
                boot_number=8,
                dedupe_key="ai-learning-stuck-check",
            )

            async with async_session() as s:
                state = await get_or_create_state(s)
                state.status = "深度学习中"
                state.boot_number = 8
                await s.commit()

            get_session().status = "深度学习中"
            await asyncio.sleep(0.05)

            async with async_session() as s:
                info = await detect_stuck_state(s)

            release.set()
            await meta.task
            return info

        info = asyncio.run(_run())
        self.assertFalse(info["stuck"])
        self.assertEqual(info["status"], "深度学习中")
        self.assertEqual(info["expected_task_type"], "deep_learning")
        self.assertGreaterEqual(info["db_running_count"], 1)

    def test_ai_learning_log_helper_keeps_task_id(self):
        async def _run():
            from sqlalchemy import select
            from app.core.database import init_db, async_session
            from app.models.schemas import SystemLog
            from app.services.ai_learning_service import AILearningService
            from app.services.game.session import start_background_task

            await init_db()

            async def job():
                async with async_session() as session:
                    service = AILearningService(session)
                    await service._write_log(
                        event_code="LOG-AI-TASK",
                        event_type="AI学习测试",
                        event_result="成功",
                        description="should keep task id",
                    )

            meta = start_background_task(
                "ai_learning",
                job(),
                boot_number=5,
                dedupe_key="ai-learning-log-task-id",
            )
            await meta.task

            async with async_session() as s:
                row = (
                    await s.execute(
                        select(SystemLog)
                        .where(SystemLog.event_code == "LOG-AI-TASK")
                        .order_by(SystemLog.id.desc())
                    )
                ).scalars().first()
                return meta.task_id, row.task_id if row else None

        task_id, log_task_id = asyncio.run(_run())
        self.assertEqual(task_id, log_task_id)


if __name__ == "__main__":
    unittest.main()
