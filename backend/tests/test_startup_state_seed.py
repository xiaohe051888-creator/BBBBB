import os
import sys
import unittest
import asyncio
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

    def test_apply_startup_session_seed_updates_only_present_fields(self):
        from app.services.startup_state import apply_startup_session_seed

        session = SimpleNamespace(
            balance=1.0,
            boot_number=1,
            next_game_number=1,
            consecutive_errors=0,
            prediction_mode="rule",
        )

        apply_startup_session_seed(
            session,
            {
                "balance": 99.5,
                "boot_number": 8,
                "next_game_number": 12,
                "consecutive_errors": 3,
                "prediction_mode": "single_ai",
            },
        )
        self.assertEqual(session.balance, 99.5)
        self.assertEqual(session.boot_number, 8)
        self.assertEqual(session.next_game_number, 12)
        self.assertEqual(session.consecutive_errors, 3)
        self.assertEqual(session.prediction_mode, "single_ai")

        apply_startup_session_seed(session, {"prediction_mode": "rule"})
        self.assertEqual(session.balance, 99.5)
        self.assertEqual(session.boot_number, 8)
        self.assertEqual(session.next_game_number, 12)
        self.assertEqual(session.consecutive_errors, 3)
        self.assertEqual(session.prediction_mode, "rule")

    def test_resolve_startup_session_seed_normalizes_mode_before_building_seed(self):
        from app.services.startup_state import resolve_startup_session_seed

        seed = resolve_startup_session_seed(
            SimpleNamespace(
                balance=888,
                boot_number=4,
                game_number=5,
                consecutive_errors=2,
                prediction_mode="ai",
            ),
            {
                "OPENAI_API_KEY": "openai-key-123",
                "ANTHROPIC_API_KEY": "",
                "GEMINI_API_KEY": "gemini-key-123",
                "SINGLE_AI_API_KEY": "single-key-123",
            },
        )

        self.assertEqual(
            seed,
            {
                "balance": 888.0,
                "boot_number": 4,
                "next_game_number": 6,
                "consecutive_errors": 2,
                "prediction_mode": "rule",
            },
        )

    def test_resolve_startup_session_seed_from_settings_reads_secret_keys_from_settings(self):
        from app.services.startup_state import resolve_startup_session_seed_from_settings

        settings = SimpleNamespace(
            OPENAI_API_KEY="openai-key-123",
            ANTHROPIC_API_KEY="",
            GEMINI_API_KEY="gemini-key-123",
            SINGLE_AI_API_KEY="single-key-123",
        )
        state = SimpleNamespace(
            balance=666,
            boot_number=3,
            game_number=4,
            consecutive_errors=1,
            prediction_mode="ai",
        )

        seed = resolve_startup_session_seed_from_settings(state, settings)

        self.assertEqual(seed["prediction_mode"], "rule")
        self.assertEqual(seed["next_game_number"], 5)
        self.assertEqual(seed["boot_number"], 3)

    def test_reconcile_startup_runtime_state_persists_changed_mode_and_applies_seed(self):
        from app.services.startup_state import reconcile_startup_runtime_state

        state = SimpleNamespace(
            balance=500,
            boot_number=9,
            game_number=2,
            consecutive_errors=1,
            prediction_mode="ai",
        )
        settings = SimpleNamespace(
            OPENAI_API_KEY="openai-key-123",
            ANTHROPIC_API_KEY="",
            GEMINI_API_KEY="gemini-key-123",
            SINGLE_AI_API_KEY="single-key-123",
        )
        applied: list[dict[str, int | float | str]] = []
        persisted: list[str] = []

        async def _apply(seed):
            applied.append(seed)

        async def _persist(mode: str):
            persisted.append(mode)

        current_mode = asyncio.run(
            reconcile_startup_runtime_state(
                state,
                settings,
                apply_seed=_apply,
                persist_mode=_persist,
            )
        )

        self.assertEqual(current_mode, "rule")
        self.assertEqual(persisted, ["rule"])
        self.assertEqual(applied[0]["prediction_mode"], "rule")


if __name__ == "__main__":
    unittest.main()
