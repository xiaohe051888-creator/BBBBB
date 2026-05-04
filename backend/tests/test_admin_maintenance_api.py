import os
import sys
import unittest
import asyncio

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.api.main import app


class AdminMaintenanceApiTest(unittest.TestCase):
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

    def test_stats_requires_auth(self):
        client = TestClient(app)
        r = client.get("/api/admin/maintenance/stats")
        self.assertEqual(r.status_code, 401)

    def test_stats_and_alerts_work_with_token(self):
        self._ensure_admin_password("8888")
        client = TestClient(app)
        token = client.post("/api/admin/login", json={"password": "8888"}).json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        r = client.get("/api/admin/maintenance/stats", headers=headers)
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertIn("counts", body)
        self.assertIn("config", body)

        r2 = client.get("/api/admin/maintenance/alerts", headers=headers)
        self.assertEqual(r2.status_code, 200)
        self.assertIn("count", r2.json())

    def test_retention_run_returns_summary(self):
        self._ensure_admin_password("8888")
        client = TestClient(app)
        token = client.post("/api/admin/login", json={"password": "8888"}).json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        r = client.post("/api/admin/maintenance/retention/run", headers=headers)
        self.assertEqual(r.status_code, 200)
        self.assertIn("deleted", r.json())

    def test_reset_all_clears_tables(self):
        async def _seed():
            from datetime import datetime
            from sqlalchemy import select

            from app.core.database import init_db, async_session
            from app.models.schemas import GameRecord, BetRecord, SystemLog, MistakeBook, SystemState

            await init_db()
            async with async_session() as s:
                boot = 999998
                await s.execute(GameRecord.__table__.delete().where(GameRecord.boot_number == boot))
                await s.execute(BetRecord.__table__.delete().where(BetRecord.boot_number == boot))
                await s.execute(SystemLog.__table__.delete().where(SystemLog.boot_number == boot))
                await s.execute(MistakeBook.__table__.delete().where(MistakeBook.boot_number == boot))
                state = (await s.execute(select(SystemState).where(SystemState.singleton_key == 1))).scalar_one_or_none()
                if not state:
                    s.add(SystemState(singleton_key=1, status="手动模式", boot_number=1, game_number=0, prediction_mode="rule"))
                s.add(GameRecord(boot_number=boot, game_number=1, result="庄"))
                s.add(BetRecord(boot_number=boot, game_number=1, bet_direction="庄", bet_amount=10, balance_before=100, balance_after=90))
                s.add(SystemLog(log_time=datetime.now(), boot_number=boot, game_number=1, event_code="UT", event_type="测试", event_result="OK", description="seed", category="测试", priority="P3"))
                s.add(MistakeBook(boot_number=boot, game_number=1, error_id="E1", error_type="趋势误判", predict_direction="庄", actual_result="闲"))
                await s.commit()

        asyncio.run(_seed())

        self._ensure_admin_password("8888")
        client = TestClient(app)
        token = client.post("/api/admin/login", json={"password": "8888"}).json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        r = client.post("/api/admin/maintenance/reset-all", headers=headers)
        self.assertEqual(r.status_code, 200)
        deleted = r.json().get("deleted") or {}
        self.assertGreaterEqual(deleted.get("game_records", 0), 1)
        self.assertGreaterEqual(deleted.get("bet_records", 0), 1)
        self.assertGreaterEqual(deleted.get("system_logs", 0), 1)
        self.assertGreaterEqual(deleted.get("mistake_book", 0), 1)

        r2 = client.get("/api/admin/maintenance/stats", headers=headers)
        self.assertEqual(r2.status_code, 200)
        counts = r2.json().get("counts") or {}
        self.assertEqual(counts.get("game_records_total"), 0)
        self.assertEqual(counts.get("bet_records_total"), 0)
        self.assertEqual(counts.get("system_logs_total"), 0)


if __name__ == "__main__":
    unittest.main()
