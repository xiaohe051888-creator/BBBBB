import asyncio
import os
import sys
import unittest
from types import SimpleNamespace
from uuid import uuid4

from unittest.mock import patch

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
            from app.services.game.boot import end_boot, run_deep_learning

            await init_db()
            boot = self._new_boot_number()
            await self._prepare_boot_records(boot)

            async with async_session() as s:
                res = await end_boot(s)
                await s.commit()

            self.assertTrue(res["success"])

            class _FakeService:
                def __init__(self, db):
                    self.db = db

                async def start_learning(self, boot_number: int):
                    return SimpleNamespace(success=True, version="v-test", error=None)

            with patch("app.services.ai_learning_service.AILearningService", _FakeService):
                await run_deep_learning(boot)

            async with async_session() as s:
                state = (await s.execute(select(SystemState).order_by(SystemState.id.desc()).limit(1))).scalars().first()
                logs = (await s.execute(select(SystemLog).where(SystemLog.event_code == "LOG-BOOT-002"))).scalars().all()
                return state.status if state else None, len(logs)

        status, log_count = asyncio.run(_run())
        self.assertEqual(status, "等待新靴")
        self.assertGreaterEqual(log_count, 1)


if __name__ == "__main__":
    unittest.main()

