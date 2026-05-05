import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class SystemDiagnosticsModeAwareTest(unittest.TestCase):
    def test_diagnostics_contains_current_mode_and_mode_readiness(self):
        async def _run():
            from app.api.routes.system import get_system_diagnostics
            from app.services.game.session import get_session, get_session_lock

            lock = get_session_lock()
            async with lock:
                sess = get_session()
                sess.prediction_mode = "rule"

            res = await get_system_diagnostics()
            return res

        res = asyncio.run(_run())
        self.assertIn("current_mode", res)
        self.assertIn("mode_readiness", res)
        self.assertIn("models", res)
        self.assertIn("issues_current_mode", res)
        self.assertIn("issues_other_modes", res)
        self.assertIn("overall_status_current_mode", res)
        self.assertEqual(res["current_mode"], "rule")
        self.assertEqual(res["mode_readiness"]["rule"]["status"], "ok")

    def test_diagnostics_excludes_legacy_model_summary_fields(self):
        async def _run():
            from app.api.routes.system import get_system_diagnostics

            return await get_system_diagnostics()

        res = asyncio.run(_run())
        self.assertNotIn("openai_enabled", res)
        self.assertNotIn("anthropic_enabled", res)
        self.assertNotIn("gemini_enabled", res)
        self.assertNotIn("ai_configured_count", res)
        self.assertNotIn("models_detail", res)


if __name__ == "__main__":
    unittest.main()
