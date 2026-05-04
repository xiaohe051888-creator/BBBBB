import asyncio
import os
import sys
import unittest
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class StartupRecoveryPendingBetTest(unittest.TestCase):
    def test_recover_on_startup_restores_pending_bet(self):
        async def _run():
            from app.core.database import init_db, async_session
            from app.models.schemas import BetRecord
            from app.services.game.state import get_or_create_state
            from app.services.game.recovery import recover_on_startup
            from app.services.game.session import get_session, get_session_lock

            await init_db()

            async with async_session() as s:
                state = await get_or_create_state(s)
                state.boot_number = 1
                state.game_number = 3
                state.status = "空闲"
                await s.commit()

            lock = get_session_lock()
            async with lock:
                mem = get_session()
                mem.boot_number = 1
                mem.next_game_number = 4
                mem.status = "空闲"
                mem.pending_bet_direction = None
                mem.pending_bet_amount = None
                mem.pending_bet_tier = None
                mem.pending_bet_time = None
                mem.pending_game_number = None

            async with async_session() as s:
                s.add(
                    BetRecord(
                        boot_number=1,
                        game_number=4,
                        bet_seq=1,
                        bet_direction="庄",
                        bet_amount=10.0,
                        bet_tier="标准",
                        status="待开奖",
                        balance_before=20000.0,
                        balance_after=19990.0,
                        bet_time=datetime.now(),
                    )
                )
                await s.commit()

            async with async_session() as s:
                await recover_on_startup(s)

            async with async_session() as s:
                state2 = await get_or_create_state(s)
                status2 = state2.status

            async with lock:
                mem2 = get_session()
                return (
                    status2,
                    mem2.status,
                    mem2.pending_bet_direction,
                    mem2.pending_game_number,
                )

        status2, mem_status2, pending_dir, pending_game = asyncio.run(_run())
        self.assertEqual(status2, "等待开奖")
        self.assertEqual(mem_status2, "等待开奖")
        self.assertEqual(pending_dir, "庄")
        self.assertEqual(pending_game, 4)


if __name__ == "__main__":
    unittest.main()

