import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class AiLearningCancelLoggingTest(unittest.TestCase):
    def test_cancel_wrapper_does_not_crash(self):
        async def _run():
            from app.core.database import async_session
            from app.services.game.task_registry import registry

            async def job():
                async with async_session():
                    await asyncio.sleep(5)

            meta = registry.create("ai_learning", job(), boot_number=0, dedupe_key="ai_learning:test_cancel")
            meta.task.cancel()
            try:
                await meta.task
            except asyncio.CancelledError:
                pass
            return meta.status

        status = asyncio.run(_run())
        self.assertIn(status, ("cancelled", "failed", "running", "succeeded"))


if __name__ == "__main__":
    unittest.main()

