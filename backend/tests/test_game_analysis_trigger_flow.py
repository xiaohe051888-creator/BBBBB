import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class GameAnalysisTriggerFlowTest(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
