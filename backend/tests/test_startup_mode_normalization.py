import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class StartupModeNormalizationTest(unittest.TestCase):
    def test_ai_mode_falls_back_to_rule_when_any_required_key_is_missing(self):
        from app.services.startup_mode import normalize_startup_prediction_mode

        self.assertEqual(
            normalize_startup_prediction_mode(
                "ai",
                {
                    "OPENAI_API_KEY": "openai-key-123",
                    "ANTHROPIC_API_KEY": "",
                    "GEMINI_API_KEY": "gemini-key-123",
                    "SINGLE_AI_API_KEY": "single-key-123",
                },
            ),
            "rule",
        )

    def test_single_ai_mode_falls_back_to_rule_when_single_key_is_missing(self):
        from app.services.startup_mode import normalize_startup_prediction_mode

        self.assertEqual(
            normalize_startup_prediction_mode(
                "single_ai",
                {
                    "OPENAI_API_KEY": "openai-key-123",
                    "ANTHROPIC_API_KEY": "anthropic-key-123",
                    "GEMINI_API_KEY": "gemini-key-123",
                    "SINGLE_AI_API_KEY": "",
                },
            ),
            "rule",
        )

    def test_ready_modes_are_preserved(self):
        from app.services.startup_mode import normalize_startup_prediction_mode

        self.assertEqual(
            normalize_startup_prediction_mode(
                "ai",
                {
                    "OPENAI_API_KEY": "openai-key-123",
                    "ANTHROPIC_API_KEY": "anthropic-key-123",
                    "GEMINI_API_KEY": "gemini-key-123",
                    "SINGLE_AI_API_KEY": "single-key-123",
                },
            ),
            "ai",
        )
        self.assertEqual(
            normalize_startup_prediction_mode(
                "single_ai",
                {
                    "OPENAI_API_KEY": "",
                    "ANTHROPIC_API_KEY": "",
                    "GEMINI_API_KEY": "",
                    "SINGLE_AI_API_KEY": "single-key-123",
                },
            ),
            "single_ai",
        )


if __name__ == "__main__":
    unittest.main()
