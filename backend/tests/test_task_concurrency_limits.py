import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class TaskConcurrencyLimitsTest(unittest.TestCase):
    def test_analysis_tasks_run_serially(self):
        async def _run():
            from app.core.database import init_db
            from app.services.game.session import start_background_task

            await init_db()

            current = 0
            max_seen = 0
            release = asyncio.Event()

            async def job1():
                nonlocal current, max_seen
                current += 1
                max_seen = max(max_seen, current)
                try:
                    await release.wait()
                finally:
                    current -= 1

            async def job2():
                nonlocal current, max_seen
                current += 1
                max_seen = max(max_seen, current)
                try:
                    await release.wait()
                finally:
                    current -= 1

            m1 = start_background_task("analysis", job1(), dedupe_key="test:analysis:1")
            m2 = start_background_task("analysis", job2(), dedupe_key="test:analysis:2")

            await asyncio.sleep(0.1)
            observed = max_seen

            release.set()
            await asyncio.gather(m1.task, m2.task)
            return observed, max_seen

        observed, max_seen = asyncio.run(_run())
        self.assertEqual(observed, 1)
        self.assertEqual(max_seen, 1)


if __name__ == "__main__":
    unittest.main()
