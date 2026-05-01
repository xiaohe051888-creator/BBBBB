import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class LatestAnalysisIncludesModeAndReasoningTest(unittest.TestCase):
    def test_latest_analysis_contains_prediction_mode_and_reasoning_fields(self):
        async def _run():
            from app.api.routes.analysis import get_latest_analysis
            from app.services.game.session import get_session, get_session_lock

            lock = get_session_lock()
            async with lock:
                sess = get_session()
                sess.prediction_mode = "single_ai"
                sess.banker_summary = ""
                sess.player_summary = ""
                sess.combined_summary = "x"
                sess.combined_reasoning_points = ["p1", "p2"]
                sess.combined_reasoning_detail = "detail"
                sess.analysis_engine = {"provider": "deepseek", "model": "deepseek-v4-pro"}
                sess.predict_confidence = 0.66
                sess.predict_bet_tier = "标准"
                sess.predict_direction = "庄"
                sess.analysis_time = None

            res = await get_latest_analysis()
            return res

        res = asyncio.run(_run())
        self.assertTrue(res["has_data"])
        self.assertEqual(res["prediction_mode"], "single_ai")
        self.assertIn("engine", res)
        self.assertIn("reasoning_points", res["combined_model"])
        self.assertIn("reasoning_detail", res["combined_model"])
        self.assertEqual(res["combined_model"]["reasoning_points"], ["p1", "p2"])
        self.assertEqual(res["combined_model"]["reasoning_detail"], "detail")


if __name__ == "__main__":
    unittest.main()

