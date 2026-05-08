import asyncio
import os
import sys
import unittest

from fastapi.testclient import TestClient
from sqlalchemy import func, select

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class E2EResetClearsMistakesTest(unittest.TestCase):
    def test_reset_all_clears_review_records(self):
        os.environ["E2E_TESTING"] = "true"
        os.environ["ADMIN_DEFAULT_PASSWORD"] = "8888"

        from importlib import reload
        import app.core.config as cfg
        reload(cfg)
        if "app.api.main" in sys.modules:
            del sys.modules["app.api.main"]
        from app.api.main import app

        async def _seed():
            from app.core.database import init_db, async_session
            from sqlalchemy import delete
            from app.models.schemas import MistakeBook

            await init_db()
            async with async_session() as session:
                await session.execute(delete(MistakeBook).where(MistakeBook.boot_number == 88))
                session.add(
                    MistakeBook(
                        boot_number=88,
                        game_number=1,
                        prediction_mode="rule",
                        error_id="RESET-UT",
                        error_type="趋势误判",
                        predict_direction="庄",
                        actual_result="闲",
                    )
                )
                await session.commit()

        async def _count():
            from app.core.database import async_session
            from app.models.schemas import MistakeBook

            async with async_session() as session:
                return (
                    await session.execute(select(func.count()).select_from(MistakeBook))
                ).scalar() or 0

        asyncio.run(_seed())
        self.assertGreater(asyncio.run(_count()), 0)

        with TestClient(app) as client:
            token = client.post("/api/admin/login", json={"password": "8888"}).json()["token"]
            headers = {"Authorization": f"Bearer {token}"}
            res = client.post(
                "/api/admin/e2e/reset",
                json={"scope": "all", "boot_number": 1, "prediction_mode": "rule"},
                headers=headers,
            )
            self.assertEqual(res.status_code, 200)

        self.assertEqual(asyncio.run(_count()), 0)


if __name__ == "__main__":
    unittest.main()
