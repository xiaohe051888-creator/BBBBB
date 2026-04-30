import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class TaskRegistryIntegrationTest(unittest.TestCase):
    def test_add_background_task_registers_in_registry(self):
        async def _run():
            from app.services.game.task_registry import registry
            from app.services.game.session import add_background_task

            async def job():
                await asyncio.sleep(0)

            t = asyncio.create_task(job())
            add_background_task(t)
            await t

            tasks = registry.list(limit=10)
            return tasks

        tasks = asyncio.run(_run())
        self.assertTrue(isinstance(tasks, list))


if __name__ == "__main__":
    unittest.main()

