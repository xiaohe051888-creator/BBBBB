import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class SystemStateSingletonReadsTest(unittest.TestCase):
    def test_sync_balance_reads_singleton_row(self):
        async def _run():
            from sqlalchemy import delete

            from app.core.database import async_session, init_db
            from app.models.schemas import SystemState
            from app.services.game.state import sync_balance_from_db

            await init_db()

            async with async_session() as session:
                await session.execute(delete(SystemState))
                session.add(
                    SystemState(
                        id=99,
                        singleton_key=2,
                        balance=999,
                        boot_number=9,
                        game_number=9,
                        prediction_mode="ai",
                    )
                )
                session.add(
                    SystemState(
                        id=1,
                        singleton_key=1,
                        balance=123,
                        boot_number=2,
                        game_number=3,
                        prediction_mode="rule",
                    )
                )
                await session.commit()

            async with async_session() as session:
                await sync_balance_from_db(session)

            from app.services.game.session import get_session

            sess = get_session()
            return sess.balance, sess.boot_number, sess.prediction_mode

        balance, boot_number, prediction_mode = asyncio.run(_run())
        self.assertEqual(balance, 123.0)
        self.assertEqual(boot_number, 2)
        self.assertEqual(prediction_mode, "rule")


if __name__ == "__main__":
    unittest.main()
