import asyncio
import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class AdminLearningGlobalTest(unittest.TestCase):
    def test_start_global_learning(self):
        async def _run():
            from app.core.database import init_db, async_session
            from app.services.game.upload import upload_games
            from app.api.routes.analysis import start_ai_learning
            from app.core import config as config_module

            await init_db()

            async with async_session() as s:
                seed = await upload_games(
                    db=s,
                    games=[{"game_number": i + 1, "result": "庄"} for i in range(20)],
                    mode="reset_current_boot",
                    balance_mode="keep",
                    run_deep_learning=False,
                )
                await s.commit()
            self.assertTrue(seed["success"])

            async def _noop(self, boot_number: int, prediction_mode: str = "ai"):
                return None

            with patch("app.services.ai_learning_service.AILearningService.start_learning", _noop):
                config_module.settings.ANTHROPIC_API_KEY = "x" * 20
                res = await start_ai_learning(boot_number=0, _={"sub": "admin"})
                from app.services.game.task_registry import registry
                meta = registry._tasks.get(res["task_id"])
                if meta and meta.task:
                    await meta.task
                return res

        res = asyncio.run(_run())
        self.assertEqual(res["status"], "started")
        self.assertIn("message", res)


if __name__ == "__main__":
    unittest.main()
