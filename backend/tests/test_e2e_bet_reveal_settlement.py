import asyncio
import os
import sys
import unittest
from uuid import uuid4

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class BetRevealSettlementE2ETest(unittest.TestCase):
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
        sess.prediction_mode = "manual"

        async with async_session() as s:
            state = await get_or_create_state(s)
            state.boot_number = boot_number
            state.balance = balance
            state.status = status
            state.next_game_number = next_game_number
            await s.commit()

    def test_win_flow(self):
        async def _run():
            from sqlalchemy import select
            from app.core.database import init_db, async_session
            from app.models.schemas import BetRecord
            from app.services.game.betting import place_bet
            from app.services.game.reveal import reveal_game
            from app.services.game.session import get_session

            await init_db()
            boot = self._new_boot_number()
            await self._prepare_state(boot, balance=1000, status="等待下注", next_game_number=1)

            async with async_session() as s:
                bet_res = await place_bet(s, game_number=1, direction="庄", amount=100)
                await s.commit()
                self.assertTrue(bet_res["success"])

            async with async_session() as s:
                res = await reveal_game(s, game_number=1, result="庄")
                await s.commit()

                bet = (await s.execute(
                    select(BetRecord).where(
                        BetRecord.boot_number == boot,
                        BetRecord.game_number == 1,
                    ).order_by(BetRecord.id.desc())
                )).scalars().first()

                sess = get_session()
                return res, bet.status if bet else None, float(bet.profit_loss or 0), float(bet.settlement_amount or 0), float(bet.balance_after or 0), float(sess.balance)

        res, status, profit_loss, settlement_amount, balance_after, sess_balance = asyncio.run(_run())
        self.assertTrue(res["success"])
        self.assertEqual(status, "已结算")
        self.assertGreater(profit_loss, 0)
        self.assertGreater(settlement_amount, 0)
        self.assertEqual(balance_after, sess_balance)

    def test_lose_flow(self):
        async def _run():
            from sqlalchemy import select
            from app.core.database import init_db, async_session
            from app.models.schemas import BetRecord
            from app.services.game.betting import place_bet
            from app.services.game.reveal import reveal_game
            from app.services.game.session import get_session

            await init_db()
            boot = self._new_boot_number()
            await self._prepare_state(boot, balance=1000, status="等待下注", next_game_number=1)

            async with async_session() as s:
                bet_res = await place_bet(s, game_number=1, direction="庄", amount=100)
                await s.commit()
                self.assertTrue(bet_res["success"])

            async with async_session() as s:
                res = await reveal_game(s, game_number=1, result="闲")
                await s.commit()

                bet = (await s.execute(
                    select(BetRecord).where(
                        BetRecord.boot_number == boot,
                        BetRecord.game_number == 1,
                    ).order_by(BetRecord.id.desc())
                )).scalars().first()

                sess = get_session()
                return res, bet.status if bet else None, float(bet.profit_loss or 0), float(bet.settlement_amount or 0), float(bet.balance_after or 0), float(sess.balance)

        res, status, profit_loss, settlement_amount, balance_after, sess_balance = asyncio.run(_run())
        self.assertTrue(res["success"])
        self.assertEqual(status, "已结算")
        self.assertLess(profit_loss, 0)
        self.assertEqual(settlement_amount, 0.0)
        self.assertEqual(balance_after, sess_balance)

    def test_tie_refund_flow(self):
        async def _run():
            from sqlalchemy import select
            from app.core.database import init_db, async_session
            from app.models.schemas import BetRecord
            from app.services.game.betting import place_bet
            from app.services.game.reveal import reveal_game
            from app.services.game.session import get_session

            await init_db()
            boot = self._new_boot_number()
            await self._prepare_state(boot, balance=1000, status="等待下注", next_game_number=1)

            async with async_session() as s:
                bet_res = await place_bet(s, game_number=1, direction="庄", amount=100)
                await s.commit()
                self.assertTrue(bet_res["success"])

            async with async_session() as s:
                res = await reveal_game(s, game_number=1, result="和")
                await s.commit()

                bet = (await s.execute(
                    select(BetRecord).where(
                        BetRecord.boot_number == boot,
                        BetRecord.game_number == 1,
                    ).order_by(BetRecord.id.desc())
                )).scalars().first()

                sess = get_session()
                return res, bet.status if bet else None, float(bet.profit_loss or 0), float(bet.settlement_amount or 0), float(bet.balance_after or 0), float(sess.balance)

        res, status, profit_loss, settlement_amount, balance_after, sess_balance = asyncio.run(_run())
        self.assertTrue(res["success"])
        self.assertEqual(status, "和局退回")
        self.assertEqual(profit_loss, 0.0)
        self.assertEqual(settlement_amount, 100.0)
        self.assertEqual(balance_after, sess_balance)

    def test_insufficient_balance_rejected(self):
        async def _run():
            from sqlalchemy import select
            from app.core.database import init_db, async_session
            from app.models.schemas import BetRecord
            from app.services.game.betting import place_bet
            from app.services.game.session import get_session

            await init_db()
            boot = self._new_boot_number()
            await self._prepare_state(boot, balance=50, status="等待下注", next_game_number=1)

            async with async_session() as s:
                res = await place_bet(s, game_number=1, direction="庄", amount=100)
                await s.commit()

                bet = (await s.execute(
                    select(BetRecord).where(
                        BetRecord.boot_number == boot,
                        BetRecord.game_number == 1,
                        BetRecord.status == "待开奖",
                    )
                )).scalars().first()

                sess = get_session()
                return res, sess.status, bet is None

        res, status, no_bet = asyncio.run(_run())
        self.assertFalse(res["success"])
        self.assertIn("余额不足", res["error"])
        self.assertEqual(status, "余额不足")
        self.assertTrue(no_bet)


if __name__ == "__main__":
    unittest.main()

