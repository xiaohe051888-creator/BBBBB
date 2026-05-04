import asyncio
import os
import sys
import unittest
from time import time


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class StateMachineIdempotencyTest(unittest.TestCase):
    def test_place_bet_is_idempotent_for_same_game(self):
        async def _run():
            from app.core.database import async_session, init_db
            from app.services.game.session import clear_session, get_session
            from app.services.game.betting import place_bet
            from sqlalchemy import select, func
            from app.models.schemas import BetRecord

            os.makedirs(os.path.join(os.getcwd(), "data"), exist_ok=True)
            await init_db()

            boot_number = int(time())
            clear_session()
            sess = get_session()
            sess.boot_number = boot_number
            sess.next_game_number = 1
            sess.status = "等待下注"
            sess.balance = 1000.0

            async with async_session() as db:
                first = await place_bet(db=db, game_number=1, direction="庄", amount=100)
                await db.commit()

            async with async_session() as db:
                second = await place_bet(db=db, game_number=1, direction="庄", amount=100)
                await db.commit()
                count = (await db.execute(
                    select(func.count()).select_from(BetRecord).where(
                        BetRecord.boot_number == boot_number,
                        BetRecord.game_number == 1,
                    )
                )).scalar()

            return first, second, count, sess.balance

        first, second, count, bal = asyncio.run(_run())
        self.assertTrue(first.get("success"), first)
        self.assertTrue(second.get("success"), second)
        self.assertEqual(count, 1)
        self.assertEqual(bal, 900.0)

    def test_reveal_is_idempotent_for_already_revealed_game(self):
        async def _run():
            from app.core.database import async_session, init_db
            from app.services.game.session import clear_session, get_session
            from app.services.game.betting import place_bet
            from app.services.game.reveal import reveal_game

            os.makedirs(os.path.join(os.getcwd(), "data"), exist_ok=True)
            await init_db()

            boot_number = int(time())
            clear_session()
            sess = get_session()
            sess.boot_number = boot_number
            sess.next_game_number = 1
            sess.status = "等待下注"

            async with async_session() as db:
                bet = await place_bet(db=db, game_number=1, direction="庄", amount=100)
                await db.commit()
                self.assertTrue(bet.get("success"), bet)

            async with async_session() as db:
                first = await reveal_game(db=db, game_number=1, result="庄")
                await db.commit()
                self.assertTrue(first.get("success"), first)

            async with async_session() as db:
                second = await reveal_game(db=db, game_number=1, result="庄")
                await db.commit()

            return second

        res = asyncio.run(_run())
        self.assertTrue(res.get("success"), res)
        self.assertTrue(res.get("already_revealed"), res)

    def test_upload_reset_current_boot_rejected_when_waiting_result(self):
        async def _run():
            from app.core.database import async_session, init_db
            from app.services.game.session import clear_session, get_session
            from app.services.game.upload import upload_games

            os.makedirs(os.path.join(os.getcwd(), "data"), exist_ok=True)
            await init_db()

            boot_number = int(time())
            clear_session()
            sess = get_session()
            sess.boot_number = boot_number
            sess.next_game_number = 1
            sess.status = "等待开奖"

            async with async_session() as db:
                res = await upload_games(
                    db=db,
                    games=[{"game_number": 1, "result": "庄"}],
                    mode="reset_current_boot",
                    balance_mode="keep",
                    run_deep_learning=False,
                )
                await db.commit()
                return res

        res = asyncio.run(_run())
        self.assertTrue(res.get("success"), res)


if __name__ == "__main__":
    unittest.main()
