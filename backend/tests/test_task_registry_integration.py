import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class TaskRegistryIntegrationTest(unittest.TestCase):
    def test_add_background_task_registers_in_registry(self):
        async def _run():
            from app.services.game.task_registry import registry
            from app.services.game.session import start_background_task

            async def job():
                await asyncio.sleep(0)

            meta = start_background_task("background", job())
            await meta.task

            tasks = registry.list(limit=10)
            return tasks

        tasks = asyncio.run(_run())
        self.assertTrue(isinstance(tasks, list))

    def test_start_background_task_closes_duplicate_wrapped_awaitable(self):
        async def _run():
            from app.core.database import init_db
            from app.services.game.session import start_background_task

            class ClosableAwaitable:
                def __init__(self):
                    self.closed = 0

                async def _wait(self):
                    await asyncio.sleep(0)

                def __await__(self):
                    return self._wait().__await__()

                def close(self):
                    self.closed += 1

            await init_db()

            release = asyncio.Event()

            async def running_job():
                await release.wait()

            first = start_background_task("analysis", running_job(), dedupe_key="dup:analysis")
            duplicate = ClosableAwaitable()
            second = start_background_task("analysis", duplicate, dedupe_key="dup:analysis")

            self.assertEqual(first.task_id, second.task_id)
            self.assertEqual(duplicate.closed, 1)

            release.set()
            await first.task

        asyncio.run(_run())


if __name__ == "__main__":
    unittest.main()
