import asyncio
import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class GameAnalysisTriggerFlowTest(unittest.TestCase):
    def test_finalize_analysis_status_restores_waiting_state(self):
        async def _run():
            from app.core.database import init_db, async_session
            from app.services.game.session import get_session
            from app.services.game.state import get_or_create_state
            from app.api.routes.game import _finalize_analysis_cycle

            await init_db()

            sess = get_session()
            sess.status = "分析中"
            sess.boot_number = 1

            async with async_session() as session:
                state = await get_or_create_state(session)
                state.status = "分析中"
                state.boot_number = 1
                await session.commit()

            await _finalize_analysis_cycle("等待开奖")

            async with async_session() as session:
                state = await get_or_create_state(session)
                return sess.status, state.status

        mem_status, db_status = asyncio.run(_run())
        self.assertEqual(mem_status, "等待开奖")
        self.assertEqual(db_status, "等待开奖")

    def test_followup_analysis_timeout_recovers_and_clears_snapshot(self):
        async def _run():
            from app.core.config import settings
            from app.core.database import init_db, async_session
            from app.services.game.session import get_session
            from app.services.game.state import get_or_create_state
            from app.api.routes.game import _run_followup_analysis

            await init_db()

            sess = get_session()
            sess.status = "分析中"
            sess.boot_number = 1
            sess.next_game_number = 20
            sess.predict_direction = "庄"
            sess.predict_confidence = 0.52
            sess.predict_bet_tier = "保守"
            sess.predict_bet_amount = 10
            sess.combined_summary = "上一局旧分析"

            async with async_session() as session:
                state = await get_or_create_state(session)
                state.status = "分析中"
                state.boot_number = 1
                state.game_number = 19
                state.predict_direction = "庄"
                state.predict_confidence = 0.52
                state.current_bet_tier = "保守"
                await session.commit()

            async def _hang(*args, **kwargs):
                await asyncio.Event().wait()

            with patch("app.services.game.run_ai_analysis", new=_hang), patch.object(
                settings,
                "ANALYSIS_TASK_TIMEOUT_SECONDS",
                0.01,
                create=True,
            ):
                await _run_followup_analysis(1, "下一局AI分析失败(reveal)")

            async with async_session() as session:
                state = await get_or_create_state(session)
                return {
                    "mem_status": sess.status,
                    "mem_predict_direction": sess.predict_direction,
                    "mem_combined_summary": sess.combined_summary,
                    "db_status": state.status,
                    "db_predict_direction": state.predict_direction,
                    "db_predict_confidence": state.predict_confidence,
                }

        result = asyncio.run(asyncio.wait_for(_run(), timeout=0.2))
        self.assertEqual(result["mem_status"], "空闲")
        self.assertIsNone(result["mem_predict_direction"])
        self.assertIsNone(result["mem_combined_summary"])
        self.assertEqual(result["db_status"], "空闲")
        self.assertIsNone(result["db_predict_direction"])
        self.assertIsNone(result["db_predict_confidence"])


if __name__ == "__main__":
    unittest.main()
