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


if __name__ == "__main__":
    unittest.main()

