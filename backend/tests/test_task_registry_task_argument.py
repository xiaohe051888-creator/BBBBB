import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class TaskRegistryTaskArgumentTest(unittest.TestCase):
    def test_registry_create_accepts_asyncio_task(self):
        async def _run():
            from sqlalchemy import select
            from app.core.database import init_db, async_session
            from app.models.schemas import BackgroundTask
            from app.services.game.task_registry import registry

            await init_db()

            async def job():
                await asyncio.sleep(0)

            t = asyncio.create_task(job())
            meta = registry.create("background", t, dedupe_key="test:task_arg")
            await t
            for _ in range(20):
                async with async_session() as s:
                    row = (await s.execute(
                        select(BackgroundTask).where(BackgroundTask.task_id == meta.task_id)
                    )).scalars().first()
                    if row:
                        return meta.status, row.status
                await asyncio.sleep(0.05)
            return meta.status, None

        status, db_status = asyncio.run(_run())
        self.assertEqual(status, "succeeded")
        self.assertIn(db_status, ("succeeded", "running", "cancelled", "failed"))


if __name__ == "__main__":
    unittest.main()
