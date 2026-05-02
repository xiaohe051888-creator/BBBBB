import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class PredictionModeGatesTest(unittest.TestCase):
    def test_ai_mode_rejected_when_keys_missing(self):
        async def _run():
            from app.core.config import settings
            from app.api.routes.system import update_prediction_mode, PredictionModeRequest
            import app.api.routes.system as system_routes

            settings.OPENAI_API_KEY = ""
            settings.ANTHROPIC_API_KEY = ""
            settings.GEMINI_API_KEY = ""
            system_routes.settings.OPENAI_API_KEY = ""
            system_routes.settings.ANTHROPIC_API_KEY = ""
            system_routes.settings.GEMINI_API_KEY = ""

            req = PredictionModeRequest(mode="ai")
            try:
                await update_prediction_mode(req, _={})
            except Exception:
                return "error"
            return "no_error"

        name = asyncio.run(_run())
        self.assertNotEqual(name, "no_error")

    def test_ai_mode_rejected_when_not_tested(self):
        async def _run():
            from app.core.database import init_db, async_session
            from app.core.config import settings
            from app.models.schemas import AiModelConfig
            from app.services.ai_config_status import compute_config_hash
            from app.api.routes.system import update_prediction_mode, PredictionModeRequest
            import app.api.routes.system as system_routes

            await init_db()

            settings.OPENAI_API_KEY = "x" * 20
            settings.ANTHROPIC_API_KEY = "y" * 20
            settings.GEMINI_API_KEY = "z" * 20
            system_routes.settings.OPENAI_API_KEY = settings.OPENAI_API_KEY
            system_routes.settings.ANTHROPIC_API_KEY = settings.ANTHROPIC_API_KEY
            system_routes.settings.GEMINI_API_KEY = settings.GEMINI_API_KEY
            os.environ["OPENAI_API_KEY"] = settings.OPENAI_API_KEY
            os.environ["ANTHROPIC_API_KEY"] = settings.ANTHROPIC_API_KEY
            os.environ["GEMINI_API_KEY"] = settings.GEMINI_API_KEY
            settings.OPENAI_MODEL = "gpt-4o-mini"
            settings.ANTHROPIC_MODEL = "claude-3-5-sonnet-latest"
            settings.GEMINI_MODEL = "gemini-1.5-pro"
            system_routes.settings.OPENAI_MODEL = settings.OPENAI_MODEL
            system_routes.settings.ANTHROPIC_MODEL = settings.ANTHROPIC_MODEL
            system_routes.settings.GEMINI_MODEL = settings.GEMINI_MODEL
            os.environ["OPENAI_MODEL"] = settings.OPENAI_MODEL
            os.environ["ANTHROPIC_MODEL"] = settings.ANTHROPIC_MODEL
            os.environ["GEMINI_MODEL"] = settings.GEMINI_MODEL

            async with async_session() as session:
                for role, provider, model, api_key in (
                    ("banker", "openai", settings.OPENAI_MODEL, settings.OPENAI_API_KEY),
                    ("player", "anthropic", settings.ANTHROPIC_MODEL, settings.ANTHROPIC_API_KEY),
                    ("combined", "google", settings.GEMINI_MODEL, settings.GEMINI_API_KEY),
                ):
                    h = compute_config_hash(provider, model, api_key, None)
                    row = await session.get(AiModelConfig, role)
                    if row is None:
                        row = AiModelConfig(
                            role=role,
                            provider=provider,
                            model=model,
                            base_url=None,
                            config_hash=h,
                            last_test_ok=False,
                            last_test_at=None,
                            last_test_error="not tested",
                            last_test_config_hash=None,
                        )
                        session.add(row)
                    else:
                        row.provider = provider
                        row.model = model
                        row.base_url = None
                        row.config_hash = h
                        row.last_test_ok = False
                        row.last_test_at = None
                        row.last_test_error = "not tested"
                        row.last_test_config_hash = None
                await session.commit()

            req = PredictionModeRequest(mode="ai")
            try:
                await update_prediction_mode(req, _={})
            except Exception:
                return "error"
            return "no_error"

        name = asyncio.run(_run())
        self.assertNotEqual(name, "no_error")

    def test_ai_mode_allowed_when_tested_and_hash_matches(self):
        async def _run():
            from app.core.database import init_db, async_session
            from app.core.config import settings
            from app.models.schemas import AiModelConfig
            from app.services.ai_config_status import compute_config_hash
            from app.api.routes.system import update_prediction_mode, PredictionModeRequest
            import app.api.routes.system as system_routes

            await init_db()

            settings.OPENAI_API_KEY = "x" * 20
            settings.ANTHROPIC_API_KEY = "y" * 20
            settings.GEMINI_API_KEY = "z" * 20
            system_routes.settings.OPENAI_API_KEY = settings.OPENAI_API_KEY
            system_routes.settings.ANTHROPIC_API_KEY = settings.ANTHROPIC_API_KEY
            system_routes.settings.GEMINI_API_KEY = settings.GEMINI_API_KEY
            os.environ["OPENAI_API_KEY"] = settings.OPENAI_API_KEY
            os.environ["ANTHROPIC_API_KEY"] = settings.ANTHROPIC_API_KEY
            os.environ["GEMINI_API_KEY"] = settings.GEMINI_API_KEY
            settings.OPENAI_MODEL = "gpt-4o-mini"
            settings.ANTHROPIC_MODEL = "claude-3-5-sonnet-latest"
            settings.GEMINI_MODEL = "gemini-1.5-pro"
            system_routes.settings.OPENAI_MODEL = settings.OPENAI_MODEL
            system_routes.settings.ANTHROPIC_MODEL = settings.ANTHROPIC_MODEL
            system_routes.settings.GEMINI_MODEL = settings.GEMINI_MODEL
            os.environ["OPENAI_MODEL"] = settings.OPENAI_MODEL
            os.environ["ANTHROPIC_MODEL"] = settings.ANTHROPIC_MODEL
            os.environ["GEMINI_MODEL"] = settings.GEMINI_MODEL

            async with async_session() as session:
                for role, provider, model, api_key in (
                    ("banker", "openai", settings.OPENAI_MODEL, settings.OPENAI_API_KEY),
                    ("player", "anthropic", settings.ANTHROPIC_MODEL, settings.ANTHROPIC_API_KEY),
                    ("combined", "google", settings.GEMINI_MODEL, settings.GEMINI_API_KEY),
                ):
                    h = compute_config_hash(provider, model, api_key, None)
                    row = await session.get(AiModelConfig, role)
                    if row is None:
                        row = AiModelConfig(
                            role=role,
                            provider=provider,
                            model=model,
                            base_url=None,
                            config_hash=h,
                            last_test_ok=True,
                            last_test_at=None,
                            last_test_error=None,
                            last_test_config_hash=h,
                        )
                        session.add(row)
                    else:
                        row.provider = provider
                        row.model = model
                        row.base_url = None
                        row.config_hash = h
                        row.last_test_ok = True
                        row.last_test_at = None
                        row.last_test_error = None
                        row.last_test_config_hash = h
                await session.commit()

            req = PredictionModeRequest(mode="ai")
            await update_prediction_mode(req, _={})
            return "ok"

        res = asyncio.run(_run())
        self.assertEqual(res, "ok")


if __name__ == "__main__":
    unittest.main()
