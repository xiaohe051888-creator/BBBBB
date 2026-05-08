import asyncio
import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient

from app.api.main import app
from app.core.config import settings
from app.core.database import async_session
from app.models.schemas import AiModelConfig


class AiConfigPersistenceTest(unittest.TestCase):
    def _login_headers(self, client: TestClient) -> dict[str, str]:
        os.environ["ADMIN_DEFAULT_PASSWORD"] = "8888"
        res = client.post("/api/admin/login", json={"password": "8888"})
        self.assertEqual(res.status_code, 200)
        return {"Authorization": f"Bearer {res.json()['token']}"}

    def test_save_api_config_persists_encrypted_api_key_to_database(self):
        async def _check():
            async with async_session() as session:
                row = await session.get(AiModelConfig, "single")
                self.assertIsNotNone(row)
                self.assertTrue(bool(getattr(row, "api_key_encrypted", "")))
                self.assertNotEqual(getattr(row, "api_key_encrypted", ""), "sk-persist-1234567890")
                self.assertEqual(getattr(row, "api_key_last4", ""), "7890")

        with TestClient(app) as client:
            headers = self._login_headers(client)
            payload = {
                "role": "single",
                "provider": "deepseek",
                "model": "deepseek-chat",
                "api_key": "sk-persist-1234567890",
                "base_url": "https://api.deepseek.com",
            }
            res = client.post("/api/admin/api-config", json=payload, headers=headers)
            self.assertEqual(res.status_code, 200)
            asyncio.run(_check())

    def test_saved_api_config_can_restore_runtime_settings_after_restart(self):
        async def _simulate_restart():
            from app.services.ai_config_store import load_saved_ai_model_configs

            setattr(settings, "SINGLE_AI_API_KEY", "")
            setattr(settings, "SINGLE_AI_MODEL", "")
            setattr(settings, "SINGLE_AI_API_BASE", "")
            os.environ.pop("SINGLE_AI_API_KEY", None)
            os.environ.pop("SINGLE_AI_MODEL", None)
            os.environ.pop("SINGLE_AI_API_BASE", None)

            restored = await load_saved_ai_model_configs()
            self.assertGreaterEqual(restored, 1)
            self.assertEqual(settings.SINGLE_AI_API_KEY, "sk-restart-1234567890")
            self.assertEqual(settings.SINGLE_AI_MODEL, "deepseek-chat")
            self.assertEqual(settings.SINGLE_AI_API_BASE, "https://api.deepseek.com")

        with TestClient(app) as client:
            headers = self._login_headers(client)
            payload = {
                "role": "single",
                "provider": "deepseek",
                "model": "deepseek-chat",
                "api_key": "sk-restart-1234567890",
                "base_url": "https://api.deepseek.com",
            }
            res = client.post("/api/admin/api-config", json=payload, headers=headers)
            self.assertEqual(res.status_code, 200)
            asyncio.run(_simulate_restart())

    def test_production_save_api_config_does_not_write_env_file(self):
        from app.api.routes import auth as auth_routes

        with TestClient(app) as client:
            headers = self._login_headers(client)
            payload = {
                "role": "single",
                "provider": "deepseek",
                "model": "deepseek-chat",
                "api_key": "sk-prod-1234567890",
                "base_url": "https://api.deepseek.com",
            }
            old_env = settings.ENVIRONMENT
            try:
                settings.ENVIRONMENT = "production"
                with patch.object(auth_routes, "write_env_updates") as mocked_write:
                    res = client.post("/api/admin/api-config", json=payload, headers=headers)
                    self.assertEqual(res.status_code, 200)
                    mocked_write.assert_not_called()
            finally:
                settings.ENVIRONMENT = old_env


if __name__ == "__main__":
    unittest.main()
