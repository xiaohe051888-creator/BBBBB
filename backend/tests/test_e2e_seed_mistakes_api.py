import asyncio
import os
import sys
import unittest

from fastapi.testclient import TestClient
from sqlalchemy import delete, func, select

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class E2ESeedMistakesApiTest(unittest.TestCase):
    def test_seed_mistakes_creates_review_records(self):
        os.environ["E2E_TESTING"] = "true"
        os.environ["ADMIN_DEFAULT_PASSWORD"] = "8888"

        from importlib import reload
        import app.core.config as cfg
        reload(cfg)
        if "app.api.main" in sys.modules:
            del sys.modules["app.api.main"]
        from app.api.main import app

        async def _clear_boot():
            from app.core.database import init_db, async_session
            from app.models.schemas import MistakeBook

            await init_db()
            async with async_session() as session:
                await session.execute(delete(MistakeBook).where(MistakeBook.boot_number == 77))
                await session.commit()

        async def _count_seeded():
            from app.core.database import async_session
            from app.models.schemas import MistakeBook

            async with async_session() as session:
                return (
                    await session.execute(
                        select(func.count()).select_from(MistakeBook).where(MistakeBook.boot_number == 77)
                    )
                ).scalar() or 0

        asyncio.run(_clear_boot())

        with TestClient(app) as client:
            token = client.post("/api/admin/login", json={"password": "8888"}).json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            res = client.post(
                "/api/admin/e2e/seed/mistakes",
                json={"boot_number": 77, "count": 4, "prediction_mode": "rule"},
                headers=headers,
            )
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.json()["count"], 4)

        self.assertEqual(asyncio.run(_count_seeded()), 4)


if __name__ == "__main__":
    unittest.main()
