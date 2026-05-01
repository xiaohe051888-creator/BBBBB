import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class PredictionModeGatesTest(unittest.TestCase):
    def test_ai_mode_rejected_when_keys_missing(self):
        async def _run():
            from app.api.routes.system import update_prediction_mode, PredictionModeRequest

            req = PredictionModeRequest(mode="ai")
            try:
                await update_prediction_mode(req, _={})
            except Exception as e:
                return type(e).__name__
            return "no_error"

        name = asyncio.run(_run())
        self.assertNotEqual(name, "no_error")


if __name__ == "__main__":
    unittest.main()

