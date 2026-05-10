import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class ResetCurrentBootHistorySnapshotTest(unittest.TestCase):
    def test_reset_current_boot_preserves_settled_history_fields(self):
        async def _run():
            from sqlalchemy import select

            from app.core.database import async_session, init_db
            from app.models.schemas import GameRecord
            from app.services.game.session import clear_session, get_session
            from app.services.game.upload import upload_games

            os.makedirs(os.path.join(os.getcwd(), "data"), exist_ok=True)
            await init_db()
            clear_session()
            sess = get_session()
            sess.boot_number = 321
            sess.status = "等待开奖"
            sess.next_game_number = 4

            async with async_session() as db:
                await db.execute(GameRecord.__table__.delete().where(GameRecord.boot_number == 321))
                db.add(
                    GameRecord(
                        boot_number=321,
                        game_number=1,
                        result="庄",
                        predict_direction="庄",
                        predict_correct=True,
                        settlement_status="已结算",
                        profit_loss=9.5,
                        balance_after=1009.5,
                    )
                )
                db.add(
                    GameRecord(
                        boot_number=321,
                        game_number=2,
                        result="闲",
                        predict_direction="庄",
                        predict_correct=False,
                        settlement_status="已结算",
                        profit_loss=-10,
                        balance_after=999.5,
                    )
                )
                await db.commit()

                result = await upload_games(
                    db=db,
                    games=[
                        {"game_number": 1, "result": "庄"},
                        {"game_number": 2, "result": "闲"},
                        {"game_number": 3, "result": "庄"},
                    ],
                    mode="reset_current_boot",
                    balance_mode="keep",
                    run_deep_learning=False,
                )
                await db.commit()

                records = (
                    await db.execute(
                        select(GameRecord)
                        .where(GameRecord.boot_number == result["boot_number"])
                        .order_by(GameRecord.game_number.asc())
                    )
                ).scalars().all()
                return result, records

        result, records = asyncio.run(_run())

        self.assertTrue(result["success"], result)
        self.assertEqual(records[0].predict_direction, "庄")
        self.assertTrue(records[0].predict_correct)
        self.assertEqual(float(records[0].profit_loss), 9.5)
        self.assertFalse(records[1].predict_correct)
        self.assertEqual(float(records[1].profit_loss), -10.0)
        self.assertIsNone(records[2].predict_direction)
