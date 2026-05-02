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


if __name__ == "__main__":
    unittest.main()
