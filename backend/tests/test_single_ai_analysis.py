import asyncio
import os
import sys
import unittest
from unittest.mock import AsyncMock, patch
from uuid import uuid4

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class SingleAIAnalysisTest(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
