import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class SingleAiPromptTemplatesApiTest(unittest.TestCase):
    def _ensure_admin_password(self, pwd: str) -> None:
        os.environ["ADMIN_DEFAULT_PASSWORD"] = pwd

    def test_get_and_set_single_ai_templates(self):
        from fastapi.testclient import TestClient
        from app.api.main import app

        self._ensure_admin_password("8888")
        with TestClient(app) as client:
            token = client.post("/api/admin/login", json={"password": "8888"}).json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            payload = {
                "prediction_template": "PRED {{BOOT_NUMBER}} {{GAME_NUMBER}} {{GAME_HISTORY}}",
                "realtime_strategy_template": "REAL {{CONSECUTIVE_ERRORS}} {{ROAD_DATA}}",
            }
            r = client.post("/api/admin/prompt-templates/single-ai", json=payload, headers=headers)
            self.assertEqual(r.status_code, 200)

            r2 = client.get("/api/admin/prompt-templates/single-ai", headers=headers)
            self.assertEqual(r2.status_code, 200)
            data = r2.json()
            self.assertEqual(data["prediction_mode"], "single_ai")
            self.assertIn("PRED", data.get("prediction_template") or "")
            self.assertIn("REAL", data.get("realtime_strategy_template") or "")

    def test_update_single_ai_templates_persists_realtime_template_to_database(self):
        from fastapi.testclient import TestClient
        from app.api.main import app
        from app.core.database import async_session
        from app.models.schemas import AiModelConfig

        async def _check():
            async with async_session() as session:
                row = await session.get(AiModelConfig, "single")
                self.assertIsNotNone(row)
                stored = getattr(row, "realtime_strategy_prompt_b64", "") or ""
                self.assertTrue(bool(stored))
                self.assertNotEqual(stored, "REAL {{CONSECUTIVE_ERRORS}} {{ROAD_DATA}}")

        self._ensure_admin_password("8888")
        with TestClient(app) as client:
            token = client.post("/api/admin/login", json={"password": "8888"}).json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            payload = {
                "realtime_strategy_template": "REAL {{CONSECUTIVE_ERRORS}} {{ROAD_DATA}}",
            }
            r = client.post("/api/admin/prompt-templates/single-ai", json=payload, headers=headers)
            self.assertEqual(r.status_code, 200)
            asyncio.run(_check())

    def test_saved_realtime_template_can_restore_after_restart(self):
        from fastapi.testclient import TestClient
        from app.api.main import app
        from app.core.config import settings
        from app.services.ai_config_store import load_saved_ai_model_configs

        self._ensure_admin_password("8888")
        with TestClient(app) as client:
            token = client.post("/api/admin/login", json={"password": "8888"}).json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            payload = {
                "realtime_strategy_template": "REAL {{CONSECUTIVE_ERRORS}} {{ROAD_DATA}}",
            }
            r = client.post("/api/admin/prompt-templates/single-ai", json=payload, headers=headers)
            self.assertEqual(r.status_code, 200)

            setattr(settings, "SINGLE_AI_REALTIME_STRATEGY_PROMPT_B64", "")
            os.environ.pop("SINGLE_AI_REALTIME_STRATEGY_PROMPT_B64", None)

            asyncio.run(load_saved_ai_model_configs())

            r2 = client.get("/api/admin/prompt-templates/single-ai", headers=headers)
            self.assertEqual(r2.status_code, 200)
            self.assertIn("REAL", r2.json().get("realtime_strategy_template") or "")

    def test_single_ai_manual_version_name_fits_database_limit(self):
        from app.api.routes.auth import build_single_ai_manual_version_name

        version = build_single_ai_manual_version_name()

        self.assertLessEqual(len(version), 30)
        self.assertTrue(version.startswith("single_ai_manual_"))


if __name__ == "__main__":
    unittest.main()
