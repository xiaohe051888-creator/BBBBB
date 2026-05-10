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
        async with async_session() as session:
            row = await session.get(AiModelConfig, "single")
            self.assertIsNotNone(row)
            cfg_hash = compute_config_hash(row.provider, row.model, api_key, row.base_url)
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

    async def _seed_runtime_prediction_snapshot(self) -> None:
        from app.services.game.session import get_session

        async with async_session() as session:
            state = await get_or_create_state(session)
            state.status = "分析完成"
            state.predict_direction = "庄"
            state.predict_confidence = 0.91
            state.current_bet_tier = "激进"
            await session.commit()

        mem = get_session()
        mem.status = "分析完成"
        mem.predict_direction = "庄"
        mem.predict_confidence = 0.91
        mem.predict_bet_tier = "激进"
        mem.predict_bet_amount = 300
        mem.pending_bet_direction = None
        mem.pending_bet_amount = None
        mem.pending_bet_tier = None
        mem.pending_bet_time = None
        mem.pending_game_number = None
        mem.banker_summary = "旧庄方向摘要"
        mem.player_summary = "旧闲方向摘要"
        mem.combined_summary = "旧综合摘要"
        mem.combined_reasoning_points = ["旧推理"]
        mem.combined_reasoning_detail = "旧推理详情"
        mem.analysis_engine = {"provider": "3ai"}
        mem.analysis_time = datetime.now(UTC)

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

    def test_saving_single_ai_config_forces_deepseek_v4_pro_and_official_base_url(self):
        api_key = "sk-force-1234567890"
        with TestClient(app) as client:
            headers = self._login_headers(client)
            res = client.post(
                "/api/admin/api-config",
                json={
                    "role": "single",
                    "provider": "custom",
                    "model": "some-other-model",
                    "api_key": api_key,
                    "base_url": "",
                },
                headers=headers,
            )
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.json()["status"], "success")

            async def _check():
                async with async_session() as session:
                    row = await session.get(AiModelConfig, "single")
                    self.assertIsNotNone(row)
                    return row.provider, row.model, row.base_url

            provider, model, base_url = self._run_async(_check())
            self.assertEqual(provider, "deepseek")
            self.assertEqual(model, "deepseek-v4-pro")
            self.assertEqual(base_url, "https://api.deepseek.com")

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

    def test_switching_mode_clears_stale_prediction_snapshot(self):
        api_key = "sk-pass-clear-1234567890"
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
            self._run_async(self._seed_runtime_prediction_snapshot())

            mode_res = client.post(
                "/api/system/prediction-mode",
                json={"mode": "single_ai"},
                headers=headers,
            )
            self.assertEqual(mode_res.status_code, 200)

            mem = get_session()
            self.assertEqual(mem.prediction_mode, "single_ai")
            self.assertEqual(mem.status, "空闲")
            self.assertIsNone(mem.predict_direction)
            self.assertIsNone(mem.predict_confidence)
            self.assertIsNone(mem.predict_bet_tier)
            self.assertIsNone(mem.predict_bet_amount)
            self.assertIsNone(mem.banker_summary)
            self.assertIsNone(mem.player_summary)
            self.assertIsNone(mem.combined_summary)
            self.assertIsNone(mem.combined_reasoning_points)
            self.assertIsNone(mem.combined_reasoning_detail)
            self.assertIsNone(mem.analysis_engine)
            self.assertIsNone(mem.analysis_time)

            async def _check_state():
                async with async_session() as session:
                    state = await get_or_create_state(session)
                    return (
                        state.prediction_mode,
                        state.status,
                        state.predict_direction,
                        state.predict_confidence,
                        state.current_bet_tier,
                    )

            prediction_mode, status, predict_direction, predict_confidence, bet_tier = self._run_async(_check_state())
            self.assertEqual(prediction_mode, "single_ai")
            self.assertEqual(status, "空闲")
            self.assertIsNone(predict_direction)
            self.assertIsNone(predict_confidence)
            self.assertEqual(bet_tier, "标准")


if __name__ == "__main__":
    unittest.main()
