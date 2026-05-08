import asyncio
import os
import sys
import unittest

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.api.main import app


class AdminDatabaseRecordsApiTest(unittest.TestCase):
    def test_database_records_returns_total_count(self):
        async def _seed():
            from app.core.database import init_db, async_session
            from sqlalchemy import delete
            from app.models.schemas import MistakeBook

            await init_db()

            async with async_session() as session:
                await session.execute(delete(MistakeBook))
                session.add_all(
                    [
                        MistakeBook(
                            boot_number=1,
                            game_number=1,
                            error_id="ERR-1",
                            error_type="趋势误判",
                            predict_direction="庄",
                            actual_result="闲",
                        ),
                        MistakeBook(
                            boot_number=1,
                            game_number=2,
                            error_id="ERR-2",
                            error_type="转折误判",
                            predict_direction="闲",
                            actual_result="庄",
                        ),
                    ]
                )
                await session.commit()

        asyncio.run(_seed())

        with TestClient(app) as client:
            os.environ["ADMIN_DEFAULT_PASSWORD"] = "8888"
            login = client.post("/api/admin/login", json={"password": "8888"})
            self.assertEqual(login.status_code, 200)
            headers = {"Authorization": f"Bearer {login.json()['token']}"}

            res = client.get(
                "/api/admin/database-records",
                params={"table_name": "mistake_book", "page": 1, "page_size": 1},
                headers=headers,
            )
            self.assertEqual(res.status_code, 200)
            payload = res.json()
            self.assertEqual(payload["table"], "mistake_book")
            self.assertEqual(payload["page"], 1)
            self.assertEqual(payload["page_size"], 1)
            self.assertEqual(payload["total"], 2)
            self.assertEqual(len(payload["data"]), 1)


if __name__ == "__main__":
    unittest.main()
