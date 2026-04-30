import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class LogTaskIdLinkTest(unittest.TestCase):
    def test_write_game_log_auto_sets_task_id(self):
        async def _run():
            from sqlalchemy import select
            from app.core.database import init_db
            from app.core.database import async_session
            from app.models.schemas import SystemLog
            from app.services.game.task_registry import registry
            from app.services.game.logging import write_game_log

            await init_db()

            async def job():
                async with async_session() as s:
                    await write_game_log(
                        s,
                        boot_number=1,
                        game_number=None,
                        event_code="LOG-TEST-001",
                        event_type="测试",
                        event_result="成功",
                        description="task log link",
                        category="测试",
                        priority="P3",
                        source_module="Test",
                    )
                    await s.commit()

            meta = registry.create("test", job(), boot_number=1, dedupe_key="test:log")
            await meta.task

            async with async_session() as s:
                row = (await s.execute(
                    select(SystemLog).where(SystemLog.event_code == "LOG-TEST-001").order_by(SystemLog.id.desc())
                )).scalars().first()
                return meta.task_id, row.task_id if row else None

        task_id, log_task_id = asyncio.run(_run())
        self.assertEqual(task_id, log_task_id)


if __name__ == "__main__":
    unittest.main()
