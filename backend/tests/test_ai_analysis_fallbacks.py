import asyncio
import os
import sys
import unittest
from unittest.mock import patch
from uuid import uuid4

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class AiAnalysisFallbacksTest(unittest.TestCase):
    def _new_boot_number(self) -> int:
        return int(uuid4().int % 1_000_000_000) + 1000

    async def _seed_one_game(self, boot_number: int):
        from datetime import datetime
        from app.core.database import async_session
        from app.models.schemas import GameRecord
        from app.services.game.session import get_session
        from app.services.game.state import get_or_create_state

        sess = get_session()
        sess.boot_number = boot_number
        sess.status = "等待下注"
        sess.next_game_number = 2
        sess.balance = 1000
        sess.prediction_mode = "ai"
        sess.consecutive_errors = 0

        async with async_session() as s:
            state = await get_or_create_state(s)
            state.boot_number = boot_number
            state.status = "等待下注"
            state.balance = 1000
            state.prediction_mode = "ai"
            s.add(GameRecord(
                boot_number=boot_number,
                game_number=1,
                result="庄",
                result_time=datetime.now(),
            ))
            await s.commit()

    def test_ai_analyze_exception_does_not_deadlock(self):
        async def _run():
            from app.core.database import init_db
            from app.core.config import settings
            from app.services.game.analysis import run_ai_analysis
            from app.services.game.session import get_session
            from app.core.database import async_session
            from app.services.game.state import get_or_create_state

            await init_db()
            boot = self._new_boot_number()
            await self._seed_one_game(boot)

            old = (settings.OPENAI_API_KEY, settings.ANTHROPIC_API_KEY, settings.GEMINI_API_KEY)
            settings.OPENAI_API_KEY = "x" * 20
            settings.ANTHROPIC_API_KEY = "x" * 20
            settings.GEMINI_API_KEY = "x" * 20

            async def _boom(*_args, **_kwargs):
                raise RuntimeError("boom")

            try:
                with patch("app.services.three_model_service.ThreeModelService.analyze", _boom):
                    async with async_session() as s:
                        res = await run_ai_analysis(s, boot_number=boot)
                        await s.commit()

                sess = get_session()
                async with async_session() as s:
                    state = await get_or_create_state(s)
                return res, sess.status, state.status
            finally:
                settings.OPENAI_API_KEY, settings.ANTHROPIC_API_KEY, settings.GEMINI_API_KEY = old

        res, mem_status, db_status = asyncio.run(_run())
        self.assertTrue(res["success"])
        self.assertNotEqual(mem_status, "分析中")
        self.assertNotEqual(db_status, "分析中")

    def test_ai_mode_without_keys_downgrades_to_rule(self):
        async def _run():
            from app.core.database import init_db
            from app.core.config import settings
            from app.services.game.analysis import run_ai_analysis
            from app.services.game.session import get_session
            from app.core.database import async_session

            await init_db()
            boot = self._new_boot_number()
            await self._seed_one_game(boot)

            old = (settings.OPENAI_API_KEY, settings.ANTHROPIC_API_KEY, settings.GEMINI_API_KEY)
            settings.OPENAI_API_KEY = ""
            settings.ANTHROPIC_API_KEY = ""
            settings.GEMINI_API_KEY = ""

            try:
                async with async_session() as s:
                    res = await run_ai_analysis(s, boot_number=boot)
                    await s.commit()

                sess = get_session()
                return res, sess.prediction_mode
            finally:
                settings.OPENAI_API_KEY, settings.ANTHROPIC_API_KEY, settings.GEMINI_API_KEY = old

        res, mode = asyncio.run(_run())
        self.assertFalse(res["success"])
        self.assertEqual(mode, "ai")
        self.assertIn("接口密钥", res.get("error", ""))


if __name__ == "__main__":
    unittest.main()
