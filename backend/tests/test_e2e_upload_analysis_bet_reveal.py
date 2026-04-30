import asyncio
import os
import sys
import unittest
from uuid import uuid4

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class UploadAnalysisBetRevealE2ETest(unittest.TestCase):
    def _new_boot_number(self) -> int:
        return int(uuid4().int % 1_000_000_000) + 1000

    async def _prepare_state(self, boot_number: int, balance: float, status: str, next_game_number: int):
        from app.core.database import async_session
        from app.services.game.session import get_session
        from app.services.game.state import get_or_create_state

        sess = get_session()
        sess.boot_number = boot_number
        sess.balance = balance
        sess.status = status
        sess.next_game_number = next_game_number
        sess.pending_bet_direction = None
        sess.pending_bet_amount = None
        sess.pending_bet_tier = None
        sess.pending_bet_time = None
        sess.pending_game_number = None
        sess.predict_direction = None
        sess.predict_confidence = None
        sess.prediction_mode = "rule"
        sess.consecutive_errors = 0

        async with async_session() as s:
            state = await get_or_create_state(s)
            state.boot_number = boot_number
            state.balance = balance
            state.status = status
            state.next_game_number = next_game_number
            state.prediction_mode = "rule"
            await s.commit()

    def test_upload_analysis_bet_reveal_then_next_analysis(self):
        async def _run():
            from sqlalchemy import select
            from app.core.database import init_db, async_session
            from app.models.schemas import BetRecord
            from app.services.game.upload import upload_games
            from app.services.game.analysis import run_ai_analysis
            from app.services.game.betting import place_bet
            from app.services.game.reveal import reveal_game
            from app.services.game.session import get_session

            await init_db()
            boot = self._new_boot_number()
            await self._prepare_state(boot, balance=1000, status="等待下注", next_game_number=1)

            async with async_session() as s:
                upload_res = await upload_games(
                    db=s,
                    games=[{"game_number": 1, "result": "庄"}],
                    mode="new_boot",
                    balance_mode="keep",
                    run_deep_learning=False,
                )
                await s.commit()

            self.assertTrue(upload_res["success"])
            actual_boot = upload_res["boot_number"]

            async with async_session() as s:
                analysis_res = await run_ai_analysis(db=s, boot_number=actual_boot)
                await s.commit()

            self.assertTrue(analysis_res["success"])
            prediction = analysis_res["prediction"]
            self.assertIn(prediction, ("庄", "闲"))
            from app.services.game.bet_sizing import compute_bet_amount
            expected_amount = compute_bet_amount(analysis_res["confidence"], balance=1000)
            self.assertEqual(analysis_res["bet_amount"], expected_amount)

            async with async_session() as s:
                bet_res = await place_bet(s, game_number=analysis_res["game_number"], direction=prediction, amount=analysis_res["bet_amount"])
                await s.commit()

                bet = (await s.execute(
                    select(BetRecord).where(
                        BetRecord.boot_number == actual_boot,
                        BetRecord.game_number == analysis_res["game_number"],
                    ).order_by(BetRecord.id.desc())
                )).scalars().first()

            self.assertTrue(bet_res["success"])
            self.assertIsNotNone(bet)
            self.assertEqual(bet.status, "待开奖")
            self.assertEqual(float(bet.bet_amount), expected_amount)

            async with async_session() as s:
                reveal_res = await reveal_game(s, game_number=analysis_res["game_number"], result="闲" if prediction == "庄" else "庄")
                await s.commit()

                bet2 = (await s.execute(
                    select(BetRecord).where(
                        BetRecord.boot_number == actual_boot,
                        BetRecord.game_number == analysis_res["game_number"],
                    ).order_by(BetRecord.id.desc())
                )).scalars().first()

            self.assertTrue(reveal_res["success"])
            self.assertIsNotNone(bet2)
            self.assertIn(bet2.status, ("已结算", "和局退回"))

            async with async_session() as s:
                next_analysis = await run_ai_analysis(db=s, boot_number=actual_boot)
                await s.commit()

            sess = get_session()
            return sess.status, next_analysis["success"]

        status, ok = asyncio.run(_run())
        self.assertTrue(ok)
        self.assertIn(status, ("分析完成", "等待下注", "等待开奖"))


if __name__ == "__main__":
    unittest.main()
