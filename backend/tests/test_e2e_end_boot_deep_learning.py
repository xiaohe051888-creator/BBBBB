import asyncio
import os
import sys
import unittest
from uuid import uuid4

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class EndBootDeepLearningE2ETest(unittest.TestCase):
    def _new_boot_number(self) -> int:
        return int(uuid4().int % 1_000_000_000) + 1000

    async def _prepare_boot_records(self, boot_number: int, balance: float = 1000):
        from datetime import datetime
        from app.core.database import async_session
        from app.models.schemas import GameRecord
        from app.services.game.session import get_session
        from app.services.game.state import get_or_create_state

        sess = get_session()
        sess.boot_number = boot_number
        sess.balance = balance
        sess.status = "等待下注"
        sess.next_game_number = 6
        sess.pending_bet_direction = None
        sess.pending_game_number = None
        sess.prediction_mode = "ai"

        async with async_session() as s:
            state = await get_or_create_state(s)
            state.boot_number = boot_number
            state.balance = balance
            state.status = "等待下注"
            state.prediction_mode = "ai"

            for i in range(1, 6):
                s.add(GameRecord(
                    boot_number=boot_number,
                    game_number=i,
                    result="庄" if i % 2 == 0 else "闲",
                    result_time=datetime.now(),
                ))
            await s.commit()

    def test_end_boot_and_deep_learning_completes(self):
        async def _run():
            from sqlalchemy import select
            from app.core.database import init_db, async_session
            from app.models.schemas import SystemLog, SystemState
            from app.services.game.boot import end_boot

            await init_db()
            boot = self._new_boot_number()
            await self._prepare_boot_records(boot)

            async with async_session() as s:
                res = await end_boot(s)
                await s.commit()

            self.assertTrue(res["success"])

            async with async_session() as s:
                state = (await s.execute(select(SystemState).order_by(SystemState.id.desc()).limit(1))).scalars().first()
                logs = (await s.execute(select(SystemLog).where(SystemLog.event_code == "LOG-BOOT-001"))).scalars().all()
                return (state.boot_number if state else None), (state.status if state else None), len(logs)

        boot_number, status, log_count = asyncio.run(_run())
        self.assertIsNotNone(boot_number)
        self.assertEqual(status, "空闲")
        self.assertGreaterEqual(log_count, 1)


if __name__ == "__main__":
    unittest.main()
