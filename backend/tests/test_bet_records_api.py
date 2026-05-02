import os
import sys
import unittest
import asyncio
from datetime import datetime

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.api.main import app


class BetRecordsApiTest(unittest.TestCase):
    def _ensure_admin_password(self, password: str):
        async def _run():
            import bcrypt as _bcrypt
            from sqlalchemy import select

            from app.core.database import init_db, async_session
            from app.models.schemas import AdminUser

            await init_db()
            async with async_session() as session:
                admin = (await session.execute(select(AdminUser).where(AdminUser.username == "admin"))).scalar_one_or_none()
                if not admin:
                    admin = AdminUser(username="admin", password_hash="", must_change_password=True)
                    session.add(admin)
                admin.password_hash = _bcrypt.hashpw(password.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8")
                admin.login_attempts = 0
                admin.locked_until = None
                await session.commit()

        asyncio.run(_run())

    def _seed_bets(self, base_boot: int):
        async def _run():
            from sqlalchemy import delete

            from app.core.database import init_db, async_session
            from app.models.schemas import BetRecord

            await init_db()
            async with async_session() as s:
                await s.execute(delete(BetRecord).where(BetRecord.boot_number == base_boot))
                await s.commit()

            async with async_session() as s:
                s.add(
                    BetRecord(
                        boot_number=base_boot,
                        game_number=1,
                        bet_seq=1,
                        bet_direction="庄",
                        bet_amount=10,
                        bet_tier="标准",
                        status="待开奖",
                        balance_before=1000,
                        balance_after=990,
                        bet_time=datetime(2100, 1, 1, 0, 0, 1),
                    )
                )
                s.add(
                    BetRecord(
                        boot_number=base_boot,
                        game_number=2,
                        bet_seq=1,
                        bet_direction="闲",
                        bet_amount=50,
                        bet_tier="标准",
                        status="已结算",
                        profit_loss=5,
                        balance_before=990,
                        balance_after=995,
                        bet_time=datetime(2100, 1, 1, 0, 0, 2),
                    )
                )
                s.add(
                    BetRecord(
                        boot_number=base_boot,
                        game_number=3,
                        bet_seq=1,
                        bet_direction="庄",
                        bet_amount=20,
                        bet_tier="标准",
                        status="已结算",
                        profit_loss=-2,
                        balance_before=995,
                        balance_after=993,
                        bet_time=datetime(2100, 1, 1, 0, 0, 3),
                    )
                )
                await s.commit()

        asyncio.run(_run())

    def test_bets_support_status_filter_and_sort(self):
        base_boot = 9000000
        self._ensure_admin_password("8888")
        self._seed_bets(base_boot)

        client = TestClient(app)
        token = client.post("/api/admin/login", json={"password": "8888"}).json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        r = client.get(
            "/api/bets",
            params={"boot_number": base_boot, "status": "已结算", "sort_by": "bet_amount", "sort_order": "desc", "page_size": 50},
            headers=headers,
        )
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body["total"], 2)
        amounts = [it["bet_amount"] for it in body["data"]]
        self.assertEqual(amounts, [50, 20])


if __name__ == "__main__":
    unittest.main()

