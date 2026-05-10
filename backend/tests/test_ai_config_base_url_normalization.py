import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class AiConfigBaseUrlNormalizationTest(unittest.TestCase):
    def test_deepseek_default_base_url(self):
        from app.services.ai_config_status import normalize_base_url
        self.assertEqual(normalize_base_url("deepseek", None), "https://api.deepseek.com")

    def test_openai_default_base_url(self):
        from app.services.ai_config_status import normalize_base_url
        self.assertEqual(normalize_base_url("openai", ""), "https://api.openai.com")

    def test_anthropic_default_base_url(self):
        from app.services.ai_config_status import normalize_base_url
        self.assertEqual(normalize_base_url("anthropic", None), "https://api.anthropic.com/v1")

    def test_single_ai_runtime_config_is_fixed_to_deepseek_v4_pro_with_thinking(self):
        from app.services.single_ai_runtime import build_single_ai_runtime_config

        cfg = build_single_ai_runtime_config(
            provider="deepseek",
            model="deepseek-chat",
            base_url="https://api.deepseek.com",
            api_key="sk-test-123",
        )

        self.assertEqual(cfg["provider"], "deepseek")
        self.assertEqual(cfg["model"], "deepseek-v4-pro")
        self.assertEqual(cfg["normalized_base_url"], "https://api.deepseek.com")
        self.assertEqual(cfg["chat_completions_url"], "https://api.deepseek.com/chat/completions")
        self.assertEqual(cfg["thinking"], {"type": "enabled"})


if __name__ == "__main__":
    unittest.main()
