import os
import sys
import unittest
from types import SimpleNamespace

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class StartupStateSeedTest(unittest.TestCase):
    def test_build_startup_session_seed_uses_state_defaults(self):
        from app.services.startup_state import build_startup_session_seed

        seed = build_startup_session_seed(
            SimpleNamespace(
                balance=123,
                boot_number=2,
                game_number=3,
                consecutive_errors=4,
                prediction_mode="single_ai",
            )
        )

        self.assertEqual(
            seed,
            {
                "balance": 123.0,
                "boot_number": 2,
                "next_game_number": 4,
                "consecutive_errors": 4,
                "prediction_mode": "single_ai",
            },
        )

    def test_build_startup_session_seed_prefers_normalized_mode_and_actual_max_game(self):
        from app.services.startup_state import build_startup_session_seed

        seed = build_startup_session_seed(
            SimpleNamespace(
                balance=20000,
                boot_number=5,
                game_number=6,
                consecutive_errors=None,
                prediction_mode="ai",
            ),
            normalized_mode="rule",
            max_game_number=9,
        )

        self.assertEqual(seed["prediction_mode"], "rule")
        self.assertEqual(seed["next_game_number"], 10)
        self.assertEqual(seed["consecutive_errors"], 0)


if __name__ == "__main__":
    unittest.main()
