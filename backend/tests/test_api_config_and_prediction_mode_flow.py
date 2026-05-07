import asyncio
import os
import sys
import unittest
from datetime import datetime, UTC

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.api.main import app
from app.core.database import async_session
from app.models.schemas import AiModelConfig, SystemState
from app.services.ai_config_status import compute_config_hash
from app.services.game.session import get_session
from app.services.game.state import get_or_create_state
from sqlalchemy import select


class ApiConfigAndPredictionModeFlowTest(unittest.TestCase):
    def _login_headers(self, client: TestClient) -> dict[str, str]:
        os.environ["ADMIN_DEFAULT_PASSWORD"] = "8888"
        res = client.post("/api/admin/login", json={"password": "8888"})
        self.assertEqual(res.status_code, 200)
        return {"Authorization": f"Bearer {res.json()['token']}"}

    def _save_single_ai_config(
        self,
        client: TestClient,
        headers: dict[str, str],
        *,
        model: str,
        api_key: str,
        base_url: str = "https://api.deepseek.com",
    ) -> None:
        payload = {
            "role": "single",
            "provider": "deepseek",
            "model": model,
            "api_key": api_key,
            "base_url": base_url,
        }
        res = client.post("/api/admin/api-config", json=payload, headers=headers)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "success")

    def _run_async(self, coro):
        return asyncio.run(coro)

    async def _mark_single_ai_config_tested(
        self,
        *,
        model: str,
        api_key: str,
        base_url: str = "https://api.deepseek.com",
    ) -> None:
        cfg_hash = compute_config_hash("deepseek", model, api_key, base_url)
        async with async_session() as session:
            row = await session.get(AiModelConfig, "single")
            self.assertIsNotNone(row)
            row.last_test_ok = True
            row.last_test_at = datetime.now(UTC)
            row.last_test_error = None
            row.last_test_config_hash = cfg_hash
            state = await get_or_create_state(session)
            state.prediction_mode = "rule"
            await session.commit()

    async def _get_system_prediction_mode(self) -> str:
        async with async_session() as session:
            result = await session.execute(
                select(SystemState).where(SystemState.singleton_key == 1)
            )
            state = result.scalar_one()
            return state.prediction_mode

    def test_saving_single_ai_config_invalidates_previous_test_result(self):
        old_key = "sk-old-1234567890"
        new_key = "sk-new-1234567890"
        with TestClient(app) as client:
            headers = self._login_headers(client)
            self._save_single_ai_config(
                client,
                headers,
                model="deepseek-chat",
                api_key=old_key,
            )
            self._run_async(
                self._mark_single_ai_config_tested(
                    model="deepseek-chat",
                    api_key=old_key,
                )
            )

            self._save_single_ai_config(
                client,
                headers,
                model="deepseek-reasoner",
                api_key=new_key,
            )

            status_res = client.get("/api/admin/three-model-status", headers=headers)
            self.assertEqual(status_res.status_code, 200)
            single = status_res.json()["models"]["single"]
            self.assertTrue(single["api_key_set"])
            self.assertFalse(single["last_test_ok"])
            self.assertFalse(status_res.json()["single_ai_ready_for_enable"])

            mode_res = client.post(
                "/api/system/prediction-mode",
                json={"mode": "single_ai"},
                headers=headers,
            )
            self.assertEqual(mode_res.status_code, 409)
            self.assertIn("请先配置并测试通过", mode_res.json()["detail"])

    def test_switching_single_ai_mode_updates_db_and_runtime_state(self):
        api_key = "sk-pass-1234567890"
        with TestClient(app) as client:
            headers = self._login_headers(client)
            self._save_single_ai_config(
                client,
                headers,
                model="deepseek-chat",
                api_key=api_key,
            )
            self._run_async(
                self._mark_single_ai_config_tested(
                    model="deepseek-chat",
                    api_key=api_key,
                )
            )

            mode_res = client.post(
                "/api/system/prediction-mode",
                json={"mode": "single_ai"},
                headers=headers,
            )
            self.assertEqual(mode_res.status_code, 200)
            self.assertEqual(mode_res.json()["prediction_mode"], "single_ai")

            status_res = client.get("/api/admin/three-model-status", headers=headers)
            self.assertEqual(status_res.status_code, 200)
            self.assertTrue(status_res.json()["single_ai_ready_for_enable"])

            self.assertEqual(
                self._run_async(self._get_system_prediction_mode()),
                "single_ai",
            )
            self.assertEqual(get_session().prediction_mode, "single_ai")


if __name__ == "__main__":
    unittest.main()
