import asyncio
import os
import sys
import unittest
from unittest.mock import patch
from uuid import uuid4

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

    def test_followup_analysis_failure_falls_back_to_rule_and_places_bet(self):
        async def _run():
            from app.core.database import init_db, async_session
            from app.models.schemas import BetRecord
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
                return {
                    "mem_status": sess.status,
                    "mem_predict_direction": sess.predict_direction,
                    "mem_pending_bet_direction": sess.pending_bet_direction,
                    "mem_pending_game_number": sess.pending_game_number,
                    "db_status": state.status,
                    "db_predict_direction": state.predict_direction,
                    "bet_direction": bet["bet_direction"] if bet else None,
                    "bet_status": bet["status"] if bet else None,
                    "bet_game_number": bet["game_number"] if bet else None,
                }

        result = asyncio.run(_run())
        self.assertEqual(result["mem_status"], "等待开奖")
        self.assertIn(result["mem_predict_direction"], ("庄", "闲"))
        self.assertIn(result["mem_pending_bet_direction"], ("庄", "闲"))
        self.assertEqual(result["mem_pending_game_number"], 2)
        self.assertEqual(result["db_status"], "等待开奖")
        self.assertIn(result["db_predict_direction"], ("庄", "闲"))
        self.assertIn(result["bet_direction"], ("庄", "闲"))
        self.assertEqual(result["bet_status"], "待开奖")
        self.assertEqual(result["bet_game_number"], 2)

    def test_followup_analysis_timeout_falls_back_to_rule_and_places_bet(self):
        async def _run():
            from app.core.database import init_db, async_session
            from app.models.schemas import BetRecord
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
                return {
                    "mem_status": sess.status,
                    "mem_predict_direction": sess.predict_direction,
                    "mem_pending_bet_direction": sess.pending_bet_direction,
                    "mem_pending_game_number": sess.pending_game_number,
                    "db_status": state.status,
                    "db_predict_direction": state.predict_direction,
                    "db_predict_confidence": state.predict_confidence,
                    "bet_direction": bet["bet_direction"] if bet else None,
                    "bet_status": bet["status"] if bet else None,
                }

        result = asyncio.run(asyncio.wait_for(_run(), timeout=5.0))
        self.assertEqual(result["mem_status"], "等待开奖")
        self.assertIn(result["mem_predict_direction"], ("庄", "闲"))
        self.assertIn(result["mem_pending_bet_direction"], ("庄", "闲"))
        self.assertEqual(result["mem_pending_game_number"], 2)
        self.assertEqual(result["db_status"], "等待开奖")
        self.assertIn(result["db_predict_direction"], ("庄", "闲"))
        self.assertGreaterEqual(result["db_predict_confidence"] or 0, 0)
        self.assertIn(result["bet_direction"], ("庄", "闲"))
        self.assertEqual(result["bet_status"], "待开奖")


if __name__ == "__main__":
    unittest.main()
