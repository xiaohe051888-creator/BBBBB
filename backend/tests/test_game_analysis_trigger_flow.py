import asyncio
import os
import sys
import unittest
from unittest.mock import patch
from uuid import uuid4

from fastapi import HTTPException

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class GameAnalysisTriggerFlowTest(unittest.TestCase):
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
        sess.prediction_mode = "single_ai"
        sess.consecutive_errors = 0
        sess.pending_bet_direction = None
        sess.pending_bet_amount = None
        sess.pending_bet_tier = None
        sess.pending_bet_time = None
        sess.pending_game_number = None
        sess.predict_direction = None
        sess.predict_confidence = None
        sess.predict_bet_tier = None
        sess.predict_bet_amount = None
        sess.combined_summary = None

        async with async_session() as session:
            state = await get_or_create_state(session)
            state.boot_number = boot_number
            state.status = "等待下注"
            state.balance = 1000
            state.prediction_mode = "single_ai"
            session.add(
                GameRecord(
                    boot_number=boot_number,
                    game_number=1,
                    result="庄",
                    result_time=datetime.now(),
                )
            )
            await session.commit()

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

    def test_followup_analysis_runtime_error_marks_failed_cycle_without_rule_fallback(self):
        async def _run():
            from app.core.database import init_db, async_session
            from app.models.schemas import BetRecord, SystemLog
            from app.services.game.session import get_session
            from app.services.game.state import get_or_create_state
            from app.api.routes.game import _run_followup_analysis

            await init_db()
            boot = self._new_boot_number()
            await self._seed_one_game(boot)

            sess = get_session()
            sess.status = "分析中"

            async with async_session() as session:
                state = await get_or_create_state(session)
                state.status = "分析中"
                await session.commit()

            async def _boom(*args, **kwargs):
                raise RuntimeError("upstream exploded")

            with patch("app.services.game.run_ai_analysis", new=_boom):
                await _run_followup_analysis(boot, "下一局AI分析失败(reveal)")

            async with async_session() as session:
                state = await get_or_create_state(session)
                bet = (
                    await session.execute(
                        BetRecord.__table__.select()
                        .where(BetRecord.boot_number == boot)
                        .order_by(BetRecord.bet_seq.desc())
                        .limit(1)
                    )
                ).mappings().first()
                log = (
                    await session.execute(
                        SystemLog.__table__.select()
                        .where(SystemLog.boot_number == boot)
                        .order_by(SystemLog.id.desc())
                        .limit(1)
                    )
                ).mappings().first()
                return {
                    "mem_status": sess.status,
                    "mem_predict_direction": sess.predict_direction,
                    "mem_pending_bet_direction": sess.pending_bet_direction,
                    "mem_pending_game_number": sess.pending_game_number,
                    "mem_analysis_outcome": sess.analysis_outcome,
                    "mem_analysis_cycle": getattr(sess, "analysis_cycle", None),
                    "db_status": state.status,
                    "db_predict_direction": state.predict_direction,
                    "db_analysis_cycle_status": getattr(state, "analysis_cycle_status", None),
                    "db_analysis_failure_code": getattr(state, "analysis_failure_code", None),
                    "bet_direction": bet["bet_direction"] if bet else None,
                    "bet_status": bet["status"] if bet else None,
                    "bet_game_number": bet["game_number"] if bet else None,
                    "log_event_code": log["event_code"] if log else None,
                }

        result = asyncio.run(_run())
        self.assertEqual(result["mem_status"], "等待开奖")
        self.assertIsNone(result["mem_predict_direction"])
        self.assertIsNone(result["mem_pending_bet_direction"])
        self.assertIsNone(result["mem_pending_game_number"])
        self.assertIsNone(result["mem_analysis_outcome"])
        self.assertEqual(result["mem_analysis_cycle"]["status"], "failed")
        self.assertEqual(result["mem_analysis_cycle"]["failure_code"], "unknown")
        self.assertEqual(result["db_status"], "等待开奖")
        self.assertIsNone(result["db_predict_direction"])
        self.assertEqual(result["db_analysis_cycle_status"], "failed")
        self.assertEqual(result["db_analysis_failure_code"], "unknown")
        self.assertIsNone(result["bet_direction"])
        self.assertIsNone(result["bet_status"])
        self.assertIsNone(result["bet_game_number"])
        self.assertEqual(result["log_event_code"], "LOG-MDL-004")

    def test_followup_analysis_timeout_marks_failed_cycle_without_rule_fallback(self):
        async def _run():
            from app.core.database import init_db, async_session
            from app.models.schemas import BetRecord, SystemLog
            from app.services.game.session import get_session
            from app.services.game.state import get_or_create_state
            from app.api.routes.game import _run_followup_analysis

            await init_db()
            boot = self._new_boot_number()
            await self._seed_one_game(boot)

            sess = get_session()
            sess.status = "分析中"

            async with async_session() as session:
                state = await get_or_create_state(session)
                state.status = "分析中"
                await session.commit()

            async def _hang(*args, **kwargs):
                await asyncio.Event().wait()

            with patch("app.services.game.run_ai_analysis", new=_hang), patch(
                "app.api.routes.game._followup_analysis_timeout_seconds",
                return_value=0.01,
            ):
                await _run_followup_analysis(boot, "下一局AI分析失败(reveal)")

            async with async_session() as session:
                state = await get_or_create_state(session)
                bet = (
                    await session.execute(
                        BetRecord.__table__.select()
                        .where(BetRecord.boot_number == boot)
                        .order_by(BetRecord.bet_seq.desc())
                        .limit(1)
                    )
                ).mappings().first()
                log = (
                    await session.execute(
                        SystemLog.__table__.select()
                        .where(SystemLog.boot_number == boot)
                        .order_by(SystemLog.id.desc())
                        .limit(1)
                    )
                ).mappings().first()
                return {
                    "mem_status": sess.status,
                    "mem_predict_direction": sess.predict_direction,
                    "mem_pending_bet_direction": sess.pending_bet_direction,
                    "mem_pending_game_number": sess.pending_game_number,
                    "mem_analysis_outcome": sess.analysis_outcome,
                    "mem_analysis_cycle": getattr(sess, "analysis_cycle", None),
                    "db_status": state.status,
                    "db_predict_direction": state.predict_direction,
                    "db_predict_confidence": state.predict_confidence,
                    "db_analysis_cycle_status": getattr(state, "analysis_cycle_status", None),
                    "db_analysis_failure_code": getattr(state, "analysis_failure_code", None),
                    "bet_direction": bet["bet_direction"] if bet else None,
                    "bet_status": bet["status"] if bet else None,
                    "log_event_code": log["event_code"] if log else None,
                    "log_description": log["description"] if log else None,
                }

        result = asyncio.run(asyncio.wait_for(_run(), timeout=5.0))
        self.assertEqual(result["mem_status"], "等待开奖")
        self.assertIsNone(result["mem_predict_direction"])
        self.assertIsNone(result["mem_pending_bet_direction"])
        self.assertIsNone(result["mem_pending_game_number"])
        self.assertIsNone(result["mem_analysis_outcome"])
        self.assertEqual(result["mem_analysis_cycle"]["status"], "failed")
        self.assertEqual(result["mem_analysis_cycle"]["failure_code"], "timeout")
        self.assertEqual(result["db_status"], "等待开奖")
        self.assertIsNone(result["db_predict_direction"])
        self.assertIsNone(result["db_predict_confidence"])
        self.assertEqual(result["db_analysis_cycle_status"], "failed")
        self.assertEqual(result["db_analysis_failure_code"], "timeout")
        self.assertIsNone(result["bet_direction"])
        self.assertIsNone(result["bet_status"])
        self.assertEqual(result["log_event_code"], "LOG-MDL-004")
        self.assertIn("120 秒内没有完成", result["log_description"])

    def test_single_ai_followup_timeout_budget_is_mode_aware(self):
        from app.api.routes.game import _followup_analysis_timeout_seconds
        from app.core.config import settings

        settings.SINGLE_AI_REQUEST_TIMEOUT_SECONDS = 75
        settings.SINGLE_AI_MAX_RETRIES = 2
        settings.SINGLE_AI_TOTAL_TIMEOUT_SECONDS = 0
        settings.ANALYSIS_TASK_TIMEOUT_SECONDS = 45

        timeout = _followup_analysis_timeout_seconds("single_ai")

        self.assertGreaterEqual(timeout, 95)
        self.assertGreater(timeout, 45)

    def test_retry_single_ai_analysis_starts_new_cycle_only_once(self):
        async def _run():
            from app.core.database import init_db, async_session
            from app.models.schemas import SystemLog
            from app.services.game.session import get_session
            from app.services.game.state import get_or_create_state
            from app.api.routes.game import retry_single_ai_analysis
            from app.api.routes.schemas import RetrySingleAiAnalysisRequest

            await init_db()
            boot = self._new_boot_number()
            await self._seed_one_game(boot)

            sess = get_session()
            sess.status = "等待开奖"
            sess.prediction_mode = "single_ai"
            sess.analysis_cycle = {
                "status": "failed",
                "stage": "结果校验",
                "attempt": 1,
                "started_at": "2026-05-10T10:00:00+00:00",
                "deadline_at": "2026-05-10T10:02:00+00:00",
                "retryable": True,
                "failure_code": "timeout",
                "failure_message": "本轮满血分析在 120 秒内没有完成，因此当前还没有形成有效预测结果。",
            }

            async with async_session() as session:
                state = await get_or_create_state(session)
                state.boot_number = boot
                state.game_number = 1
                state.status = "等待开奖"
                state.prediction_mode = "single_ai"
                state.analysis_cycle_status = "failed"
                state.analysis_cycle_stage = "结果校验"
                state.analysis_cycle_attempt = 1
                state.analysis_failure_code = "timeout"
                state.analysis_failure_message = "本轮满血分析在 120 秒内没有完成，因此当前还没有形成有效预测结果。"
                state.analysis_retryable = True
                await session.commit()

            started = []

            def _fake_start_background_task(*args, **kwargs):
                started.append({"args": args, "kwargs": kwargs})
                coro = args[1] if len(args) > 1 else None
                if hasattr(coro, "close"):
                    coro.close()
                return None

            with patch("app.services.game.session.start_background_task", new=_fake_start_background_task):
                payload = RetrySingleAiAnalysisRequest(boot_number=boot, game_number=2)
                first = await retry_single_ai_analysis(payload, {})
                second_status = None
                try:
                    await retry_single_ai_analysis(payload, {})
                except HTTPException as exc:
                    second_status = exc.status_code

            async with async_session() as session:
                log = (
                    await session.execute(
                        SystemLog.__table__.select()
                        .where(SystemLog.boot_number == boot)
                        .order_by(SystemLog.id.desc())
                        .limit(1)
                    )
                ).mappings().first()

            return {
                "first": first,
                "second_status": second_status,
                "started": started,
                "cycle": sess.analysis_cycle,
                "log_event_code": log["event_code"] if log else None,
            }

        result = asyncio.run(_run())
        self.assertTrue(result["first"]["success"])
        self.assertEqual(result["second_status"], 409)
        self.assertEqual(len(result["started"]), 1)
        self.assertEqual(result["cycle"]["status"], "running")
        self.assertEqual(result["cycle"]["attempt"], 2)
        self.assertIsNone(result["cycle"]["failure_code"])
        self.assertEqual(result["log_event_code"], "LOG-MDL-005")

    def test_followup_analysis_parse_failure_marks_failed_cycle_without_rule_fallback(self):
        async def _run():
            from app.core.database import init_db, async_session
            from app.models.schemas import BetRecord, SystemLog
            from app.services.game.session import get_session
            from app.services.game.state import get_or_create_state
            from app.api.routes.game import _run_followup_analysis

            await init_db()
            boot = self._new_boot_number()
            await self._seed_one_game(boot)

            sess = get_session()
            sess.status = "分析中"

            async with async_session() as session:
                state = await get_or_create_state(session)
                state.status = "分析中"
                await session.commit()

            async def _invalid(*args, **kwargs):
                return {
                    "success": False,
                    "prediction": None,
                    "confidence": None,
                    "reason": "解析失败：缺少必须字段 summary",
                    "analysis_outcome": None,
                    "error_type": "single_ai_parse_failure",
                }

            with patch("app.services.game.run_ai_analysis", new=_invalid):
                await _run_followup_analysis(boot, "单AI正式分析失败")

            async with async_session() as session:
                state = await get_or_create_state(session)
                bet = (
                    await session.execute(
                        BetRecord.__table__.select()
                        .where(BetRecord.boot_number == boot)
                        .order_by(BetRecord.bet_seq.desc())
                        .limit(1)
                    )
                ).mappings().first()
                log = (
                    await session.execute(
                        SystemLog.__table__.select()
                        .where(SystemLog.boot_number == boot)
                        .order_by(SystemLog.id.desc())
                        .limit(1)
                    )
                ).mappings().first()
                return {
                    "mem_status": sess.status,
                    "mem_predict_direction": sess.predict_direction,
                    "mem_pending_bet_direction": sess.pending_bet_direction,
                    "mem_analysis_outcome": sess.analysis_outcome,
                    "mem_analysis_cycle": getattr(sess, "analysis_cycle", None),
                    "db_status": state.status,
                    "db_predict_direction": state.predict_direction,
                    "db_analysis_cycle_status": getattr(state, "analysis_cycle_status", None),
                    "db_analysis_failure_code": getattr(state, "analysis_failure_code", None),
                    "bet_direction": bet["bet_direction"] if bet else None,
                    "log_event_code": log["event_code"] if log else None,
                }

        result = asyncio.run(_run())
        self.assertEqual(result["mem_status"], "等待开奖")
        self.assertEqual(result["db_status"], "等待开奖")
        self.assertIsNone(result["mem_predict_direction"])
        self.assertIsNone(result["mem_pending_bet_direction"])
        self.assertIsNone(result["mem_analysis_outcome"])
        self.assertEqual(result["mem_analysis_cycle"]["status"], "failed")
        self.assertEqual(result["mem_analysis_cycle"]["failure_code"], "response_incomplete")
        self.assertIsNone(result["db_predict_direction"])
        self.assertEqual(result["db_analysis_cycle_status"], "failed")
        self.assertEqual(result["db_analysis_failure_code"], "response_incomplete")
        self.assertIsNone(result["bet_direction"])
        self.assertEqual(result["log_event_code"], "LOG-MDL-004")

    def test_pending_upload_analysis_parse_failure_uses_rule_fallback(self):
        async def _run():
            from app.core.database import init_db, async_session
            from app.models.schemas import BetRecord
            from app.services.game.session import get_session
            from app.services.game.state import get_or_create_state
            from app.services.game.boot import _run_pending_upload_analysis

            await init_db()
            boot = self._new_boot_number()
            await self._seed_one_game(boot)

            sess = get_session()
            sess.status = "分析中"

            async with async_session() as session:
                state = await get_or_create_state(session)
                state.status = "分析中"
                await session.commit()

            async def _invalid(*args, **kwargs):
                return {
                    "success": False,
                    "prediction": None,
                    "confidence": None,
                    "reason": "解析失败：缺少必须字段 summary",
                    "analysis_outcome": None,
                    "error_type": "single_ai_parse_failure",
                }

            with patch("app.services.game.run_ai_analysis", new=_invalid):
                await _run_pending_upload_analysis(boot)

            async with async_session() as session:
                state = await get_or_create_state(session)
                bet = (
                    await session.execute(
                        BetRecord.__table__.select()
                        .where(BetRecord.boot_number == boot)
                        .order_by(BetRecord.bet_seq.desc())
                        .limit(1)
                    )
                ).mappings().first()
                return {
                    "mem_status": sess.status,
                    "mem_predict_direction": sess.predict_direction,
                    "db_status": state.status,
                    "db_predict_direction": state.predict_direction,
                    "analysis_source": (sess.analysis_outcome or {}).get("source") if sess.analysis_outcome else None,
                    "bet_direction": bet["bet_direction"] if bet else None,
                    "bet_status": bet["status"] if bet else None,
                }

        result = asyncio.run(_run())
        self.assertEqual(result["mem_status"], "等待开奖")
        self.assertEqual(result["db_status"], "等待开奖")
        self.assertEqual(result["analysis_source"], "rule_fallback")
        self.assertIn(result["mem_predict_direction"], ("庄", "闲"))
        self.assertIn(result["db_predict_direction"], ("庄", "闲"))
        self.assertIn(result["bet_direction"], ("庄", "闲"))
        self.assertEqual(result["bet_status"], "待开奖")


if __name__ == "__main__":
    unittest.main()
