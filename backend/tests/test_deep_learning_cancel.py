import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class DeepLearningCancelTest(unittest.TestCase):
    def test_cancel_deep_learning_resets_status(self):
        async def _run():
            from app.services.game.session import get_session, get_session_lock
            from app.services.game.boot import run_deep_learning
            from app.core.database import async_session
            from app.services.game.state import get_or_create_state

            sess = get_session()
            lock = get_session_lock()
            async with lock:
                sess.boot_number = 1
                sess.status = "深度学习中"
                sess.deep_learning_status = {"boot_number": 1, "status": "启动中", "progress": 0, "message": "x"}

            async with async_session() as db:
                state = await get_or_create_state(db)
                state.status = "深度学习中"
                state.boot_number = 1
                await db.commit()

            t = asyncio.create_task(run_deep_learning(1))
            await asyncio.sleep(0.05)
            t.cancel()
            try:
                await t
            except asyncio.CancelledError:
                pass

            async with lock:
                s = sess.status
                d = sess.deep_learning_status or {}

            async with async_session() as db:
                state = await get_or_create_state(db)
                await db.refresh(state)
                db_status = state.status

            return s, d.get("status"), db_status

        s, dl_status, db_status = asyncio.run(_run())
        self.assertNotEqual(s, "深度学习中")
        self.assertEqual(dl_status, "已取消")
        self.assertEqual(db_status, "等待新靴")


if __name__ == "__main__":
    unittest.main()

