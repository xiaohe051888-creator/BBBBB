import asyncio
import os
import sys
import unittest
from datetime import datetime
from time import time


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class AnalysisStaleBootTest(unittest.TestCase):
    def test_run_ai_analysis_does_not_overwrite_other_boot_session(self):
        async def _run():
            from app.core.database import async_session, init_db
            from app.models.schemas import GameRecord
            from app.services.game.analysis import run_ai_analysis
            from app.services.game.session import get_session

            os.makedirs(os.path.join(os.getcwd(), "data"), exist_ok=True)
            await init_db()

            boot_number = int(time())
            async with async_session() as db:
                db.add(GameRecord(boot_number=boot_number, game_number=1, result="庄", result_time=datetime.now()))
                await db.commit()

            sess = get_session()
            sess.boot_number = boot_number + 1
            sess.status = "空闲"

            async with async_session() as db:
                res = await run_ai_analysis(db=db, boot_number=boot_number)

            return res, sess.boot_number, sess.status, boot_number

        res, boot_number, status, target_boot = asyncio.run(_run())
        self.assertIsInstance(res, dict)
        self.assertFalse(res.get("success", True), res)
        self.assertEqual(res.get("error"), "stale_boot", res)
        self.assertEqual(boot_number, target_boot + 1)
        self.assertEqual(status, "空闲")


if __name__ == "__main__":
    unittest.main()
