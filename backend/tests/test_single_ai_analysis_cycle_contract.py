import asyncio
import os
import sys
import unittest
from datetime import datetime, UTC

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class SingleAiAnalysisCycleContractTest(unittest.TestCase):
    def test_single_ai_failed_cycle_is_exposed_by_state_and_latest_analysis(self):
        async def _run():
            from app.core.database import init_db, async_session
            from app.services.game.session import get_session, get_session_lock
            from app.services.game.state import get_or_create_state
            from app.api.routes.system import get_system_state
            from app.api.routes.analysis import get_latest_analysis

            await init_db()

            lock = get_session_lock()
            async with lock:
                sess = get_session()
                sess.boot_number = 88
                sess.next_game_number = 12
                sess.status = "等待开奖"
                sess.prediction_mode = "single_ai"
                sess.predict_direction = None
                sess.predict_confidence = None
                sess.predict_bet_tier = "标准"
                sess.combined_summary = "本轮分析未完成，当前还没有形成有效预测结果。"
                sess.combined_reasoning_detail = None
                sess.analysis_outcome = None
                sess.analysis_time = datetime.now(UTC)
                sess.analysis_cycle = {
                    "status": "failed",
                    "stage": "结果校验",
                    "attempt": 1,
                    "started_at": "2026-05-10T10:00:00",
                    "deadline_at": "2026-05-10T10:02:00",
                    "retryable": True,
                    "failure_code": "response_incomplete",
                    "failure_message": "这次分析已经返回内容，但结果不完整，系统无法把它当成有效预测结果。",
                }

            async with async_session() as session:
                state = await get_or_create_state(session)
                state.boot_number = 88
                state.game_number = 11
                state.status = "等待开奖"
                state.prediction_mode = "single_ai"
                await session.commit()

            state_payload = await get_system_state({})
            latest_payload = await get_latest_analysis({})
            return state_payload, latest_payload

        state_payload, latest_payload = asyncio.run(_run())

        self.assertEqual(state_payload["analysis_cycle"]["status"], "failed")
        self.assertEqual(state_payload["analysis_cycle"]["stage"], "结果校验")
        self.assertEqual(state_payload["analysis_cycle"]["failure_reason"]["code"], "response_incomplete")
        self.assertTrue(state_payload["analysis_cycle"]["retryable"])

        self.assertEqual(latest_payload["analysis_cycle"]["status"], "failed")
        self.assertIsNone(latest_payload["analysis_outcome"])
        self.assertIsNone(latest_payload["combined_model"]["prediction"])


if __name__ == "__main__":
    unittest.main()
