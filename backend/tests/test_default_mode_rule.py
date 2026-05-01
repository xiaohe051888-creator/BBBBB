import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class DefaultModeRuleTest(unittest.TestCase):
    def test_default_prediction_mode_is_rule(self):
        async def _run():
            from app.services.game.session import clear_session
            from app.services.game import get_current_state

            clear_session()
            mem = await get_current_state()
            return mem.get("prediction_mode")

        mode = asyncio.run(_run())
        self.assertEqual(mode, "rule")


if __name__ == "__main__":
    unittest.main()

