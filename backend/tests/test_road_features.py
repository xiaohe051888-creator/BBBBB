import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class RoadFeaturesTest(unittest.TestCase):
    def test_extracts_per_road_and_ensemble(self):
        from app.services.game.road_features import build_road_features

        game_history = [
            {"game_number": 1, "result": "庄"},
            {"game_number": 2, "result": "闲"},
            {"game_number": 3, "result": "庄"},
            {"game_number": 4, "result": "庄"},
            {"game_number": 5, "result": "闲"},
        ]
        road_data = {
            "big_road": {"display_name": "大路", "points": [{"game_number": 1, "value": "庄"}, {"game_number": 2, "value": "闲"}]},
            "bead_road": {"display_name": "珠盘路", "points": [{"game_number": 1, "value": "庄"}, {"game_number": 2, "value": "闲"}]},
            "big_eye": {"display_name": "大眼仔路", "points": [{"game_number": 3, "value": "红"}, {"game_number": 4, "value": "红"}]},
            "small_road": {"display_name": "小路", "points": [{"game_number": 3, "value": "蓝"}]},
            "cockroach_road": {"display_name": "螳螂路", "points": [{"game_number": 3, "value": "红"}]},
        }

        feat = build_road_features(boot_number=1, game_number=6, game_history=game_history, road_data=road_data)

        self.assertEqual(feat["boot_number"], 1)
        self.assertEqual(feat["game_number"], 6)
        self.assertCountEqual(
            feat["roads_present"],
            ["big_road", "bead_road", "big_eye", "small_road", "cockroach_road"],
        )

        per = feat["per_road"]
        self.assertIn("big_road", per)
        self.assertIn("big_eye", per)
        self.assertIn("ensemble", feat)
        self.assertIn("score", feat["ensemble"])
        self.assertIn("conflict_score", feat["ensemble"])
        self.assertIn("vote_detail", feat["ensemble"])
        for k in feat["roads_present"]:
            self.assertIn("run_length", feat["per_road"][k])


if __name__ == "__main__":
    unittest.main()
