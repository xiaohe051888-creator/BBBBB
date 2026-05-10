import asyncio
import os
import sys
import unittest
from unittest.mock import AsyncMock, patch
from uuid import uuid4

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class SingleAIAnalysisTest(unittest.TestCase):
    def test_single_ai_runtime_uses_deepseek_v4_pro_with_thinking_enabled(self):
        from app.services.single_ai_runtime import build_single_ai_runtime_config, build_single_ai_test_payload

        runtime_cfg = build_single_ai_runtime_config(
            provider="deepseek",
            model="deepseek-chat",
            base_url="https://api.deepseek.com",
            api_key="x" * 20,
        )
        payload = build_single_ai_test_payload()

        self.assertEqual(runtime_cfg["model"], "deepseek-v4-pro")
        self.assertEqual(runtime_cfg["thinking"], {"type": "enabled"})
        self.assertEqual(payload["model"], "deepseek-v4-pro")
        self.assertEqual(payload["thinking"], {"type": "enabled"})
        self.assertIn("只输出严格 JSON", payload["messages"][0]["content"])

    def test_run_ai_analysis_single_ai_path(self):
        async def _run():
            from app.core.database import init_db, async_session
            from app.models.schemas import GameRecord
            from app.services.game.session import get_session, get_session_lock
            from app.services.game.analysis import run_ai_analysis
            from app.core import config as config_module

            await init_db()

            boot = int(uuid4().int % 1_000_000_000) + 1000
            async with async_session() as s:
                for i in range(1, 6):
                    s.add(GameRecord(boot_number=boot, game_number=i, result="庄"))
                await s.commit()

            lock = get_session_lock()
            async with lock:
                sess = get_session()
                sess.boot_number = boot
                sess.next_game_number = 6
                sess.prediction_mode = "single_ai"

            config_module.settings.SINGLE_AI_API_KEY = "x" * 20

            with patch("app.services.single_model_service.SingleModelService._call_model", new=AsyncMock(return_value='{"final_prediction":"闲","confidence":0.9,"bet_tier":"激进","summary":"ok"}')):
                async with async_session() as s:
                    res = await run_ai_analysis(s, boot_number=boot)
                    await s.commit()
                    return res

        res = asyncio.run(_run())
        self.assertTrue(res["success"])
        self.assertEqual(res["prediction"], "闲")
        self.assertAlmostEqual(res["confidence"], 0.9, places=3)

    def test_run_ai_analysis_single_ai_supports_chinese_json_keys(self):
        async def _run():
            from app.core.database import init_db, async_session
            from app.models.schemas import GameRecord
            from app.services.game.session import get_session, get_session_lock
            from app.services.game.analysis import run_ai_analysis
            from app.core import config as config_module

            await init_db()

            boot = int(uuid4().int % 1_000_000_000) + 2000
            async with async_session() as s:
                for i in range(1, 6):
                    s.add(GameRecord(boot_number=boot, game_number=i, result="闲"))
                await s.commit()

            lock = get_session_lock()
            async with lock:
                sess = get_session()
                sess.boot_number = boot
                sess.next_game_number = 6
                sess.prediction_mode = "single_ai"

            config_module.settings.SINGLE_AI_API_KEY = "x" * 20

            chinese_json = """{
                "最终预测":"庄",
                "置信度":0.82,
                "下注档位":"保守",
                "摘要":"中文键名可正常解析",
                "推理要点":["大路偏庄","下三路收敛"],
                "推理详情":"系统已兼容中文输出键名"
            }"""

            with patch("app.services.single_model_service.SingleModelService._call_model", new=AsyncMock(return_value=chinese_json)):
                async with async_session() as s:
                    res = await run_ai_analysis(s, boot_number=boot)
                    await s.commit()
                    return res

        res = asyncio.run(_run())
        self.assertTrue(res["success"])
        self.assertEqual(res["prediction"], "庄")
        self.assertAlmostEqual(res["confidence"], 0.82, places=3)

    def test_single_ai_default_prompt_requires_strict_json_without_markdown(self):
        from app.services.single_model_service import SingleModelService

        prompt = SingleModelService()._build_prompt(
            game_number=8,
            boot_number=1,
            game_history=[{"game_number": 1, "result": "庄"}],
            road_data={"big_road": []},
            mistake_context=[],
            consecutive_errors=0,
            road_features={"pattern": "单跳"},
        )

        self.assertIn("只输出严格 JSON", prompt)
        self.assertIn("不要输出 Markdown", prompt)
        self.assertIn("final_prediction", prompt)

    def test_single_ai_default_prompt_centers_on_predicting_next_round_side(self):
        from app.services.single_model_service import SingleModelService

        prompt = SingleModelService()._build_prompt(
            game_number=8,
            boot_number=12,
            game_history=[{"game_number": 1, "result": "庄"}],
            road_data={"big_road": []},
            mistake_context=[],
            consecutive_errors=1,
            road_features={"pattern": "单跳"},
        )

        self.assertIn("预测下一局", prompt)
        self.assertIn("你只能在 `庄` 和 `闲` 中二选一".replace("`", ""), prompt.replace("`", ""))
        self.assertIn("你的任务不是讨论是否预测，而是完成预测", prompt)

    def test_single_ai_default_prompt_forbids_no_decision_language(self):
        from app.services.single_model_service import SingleModelService

        prompt = SingleModelService()._build_prompt(
            game_number=9,
            boot_number=12,
            game_history=[{"game_number": 1, "result": "闲"}],
            road_data={"big_road": []},
            mistake_context=[],
            consecutive_errors=2,
            road_features={"pattern": "混合"},
        )

        self.assertIn("即使信号冲突，也必须选庄或闲", prompt)
        self.assertIn("不允许输出“无法判断”", prompt)
        self.assertIn("只能通过降低 confidence 表达不确定性", prompt)

    def test_single_ai_default_prompt_requires_contract_fields_for_prediction_reasoning(self):
        from app.services.single_model_service import SingleModelService

        prompt = SingleModelService()._build_prompt(
            game_number=10,
            boot_number=12,
            game_history=[{"game_number": 1, "result": "庄"}],
            road_data={"big_road": []},
            mistake_context=[],
            consecutive_errors=0,
            road_features={"pattern": "长龙"},
        )

        self.assertIn('"final_prediction":"庄或闲"', prompt)
        self.assertIn('"reasoning_points"', prompt)
        self.assertIn('"reasoning_detail"', prompt)
        self.assertIn("最终只输出严格 JSON", prompt)

    def test_single_ai_invalid_text_does_not_become_fake_success(self):
        async def _run():
            from app.core.database import init_db, async_session
            from app.models.schemas import GameRecord
            from app.services.game.session import get_session, get_session_lock
            from app.services.game.analysis import run_ai_analysis
            from app.core import config as config_module

            await init_db()

            boot = int(uuid4().int % 1_000_000_000) + 3000
            async with async_session() as s:
                for i in range(1, 6):
                    s.add(GameRecord(boot_number=boot, game_number=i, result="庄"))
                await s.commit()

            lock = get_session_lock()
            async with lock:
                sess = get_session()
                sess.boot_number = boot
                sess.next_game_number = 6
                sess.prediction_mode = "single_ai"

            config_module.settings.SINGLE_AI_API_KEY = "x" * 20

            with patch(
                "app.services.single_model_service.SingleModelService._call_model",
                new=AsyncMock(return_value="我觉得这局更偏向庄，但我先解释一下原因"),
            ):
                async with async_session() as s:
                    res = await run_ai_analysis(s, boot_number=boot)
                    await s.commit()
                    return res

        res = asyncio.run(_run())
        self.assertFalse(res["success"])
        self.assertIsNone(res["prediction"])
        self.assertIsNone(res["analysis_outcome"])
        self.assertIn("解析失败", res["reason"])

    def test_single_ai_missing_required_fields_is_invalid(self):
        from app.services.single_model_service import SingleAIParseError, parse_single_ai_response

        with self.assertRaisesRegex(SingleAIParseError, "缺少必须字段"):
            parse_single_ai_response('{"final_prediction":"庄","confidence":0.5}')


if __name__ == "__main__":
    unittest.main()
