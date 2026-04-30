import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class TaskRegistryTest(unittest.TestCase):
    def test_dedupe_key_prevents_duplicate_running_tasks(self):
        async def _run():
            from app.services.game.task_registry import registry

            async def job():
                await asyncio.sleep(0.05)
                return 1

            t1 = registry.create(task_type="demo", coro=job(), boot_number=1, dedupe_key="demo:1")
            t2 = registry.create(task_type="demo", coro=job(), boot_number=1, dedupe_key="demo:1")
            self.assertEqual(t1.task_id, t2.task_id)
            await t1.task
            return registry.list()

        tasks = asyncio.run(_run())
        self.assertTrue(tasks)

    def test_cancel_marks_cancelled(self):
        async def _run():
            from app.services.game.task_registry import registry

            async def job():
                await asyncio.sleep(5)
                return 1

            t = registry.create(task_type="demo", coro=job(), boot_number=1, dedupe_key="demo:cancel")
            ok = registry.cancel(t.task_id)
            self.assertTrue(ok)
            await asyncio.sleep(0)
            meta = next(x for x in registry.list() if x["task_id"] == t.task_id)
            return meta

        meta = asyncio.run(_run())
        self.assertIn(meta["status"], ("cancelled", "failed"))


if __name__ == "__main__":
    unittest.main()

