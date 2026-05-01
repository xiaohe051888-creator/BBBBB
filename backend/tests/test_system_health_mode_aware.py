import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class SystemHealthModeAwareTest(unittest.TestCase):
    def test_rule_mode_does_not_penalize_ai_keys(self):
        async def _run():
            from app.api.routes.system import get_health_score
            from app.services.game.session import get_session, get_session_lock

            lock = get_session_lock()
            async with lock:
                sess = get_session()
                sess.prediction_mode = "rule"

            res = await get_health_score()
            return res

        res = asyncio.run(_run())
        self.assertIn("details", res)
        self.assertIn("ai_models", res["details"])
        self.assertGreaterEqual(res["details"]["ai_models"]["score"], 30)


if __name__ == "__main__":
    unittest.main()

