import asyncio
import os
import sys
import unittest
import uuid

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.api.main import app


class AdminUserManagementApiTest(unittest.TestCase):
    def _ensure_admin_password(self, password: str):
        async def _run():
            import bcrypt as _bcrypt
            from sqlalchemy import select

            from app.core.database import init_db, async_session
            from app.models.schemas import AdminUser

            await init_db()
            async with async_session() as session:
                admin = (
                    (await session.execute(select(AdminUser).where(AdminUser.username == "admin")))
                    .scalar_one_or_none()
                )
                if not admin:
                    admin = AdminUser(username="admin", password_hash="", must_change_password=True)
                    session.add(admin)
                admin.password_hash = _bcrypt.hashpw(password.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8")
                admin.login_attempts = 0
                admin.locked_until = None
                await session.commit()

        asyncio.run(_run())

    def test_admin_can_create_list_and_update_user(self):
        self._ensure_admin_password("8888")
        username = f"u1_{uuid.uuid4().hex[:8]}"
        with TestClient(app) as client:
            token = client.post("/api/admin/login", json={"password": "8888"}).json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            res = client.post(
                "/api/admin/users",
                json={"username": username, "password": "pass1234"},
                headers=headers,
            )
            self.assertEqual(res.status_code, 200)
            created = res.json()
            self.assertEqual(created["username"], username)
            self.assertTrue(created["is_active"])

            res2 = client.get("/api/admin/users", headers=headers)
            self.assertEqual(res2.status_code, 200)
            payload = res2.json()
            self.assertGreaterEqual(payload["total"], 1)
            usernames = [x["username"] for x in payload["data"]]
            self.assertIn(username, usernames)

            uid = int(created["id"])
            res3 = client.patch(
                f"/api/admin/users/{uid}",
                json={"is_active": False},
                headers=headers,
            )
            self.assertEqual(res3.status_code, 200)
            updated = res3.json()
            self.assertFalse(updated["is_active"])

            res4 = client.post("/api/auth/login", json={"username": username, "password": "pass1234"})
            self.assertEqual(res4.status_code, 401)

    def test_user_token_cannot_access_admin_user_api(self):
        self._ensure_admin_password("8888")
        username = f"u2_{uuid.uuid4().hex[:8]}"
        with TestClient(app) as client:
            admin_token = client.post("/api/admin/login", json={"password": "8888"}).json()["token"]
            admin_headers = {"Authorization": f"Bearer {admin_token}"}
            client.post(
                "/api/admin/users",
                json={"username": username, "password": "pass1234"},
                headers=admin_headers,
            )

            login = client.post("/api/auth/login", json={"username": username, "password": "pass1234"})
            self.assertEqual(login.status_code, 200)
            user_headers = {"Authorization": f"Bearer {login.json()['token']}"}

            r = client.get("/api/admin/users", headers=user_headers)
            self.assertEqual(r.status_code, 403)


if __name__ == "__main__":
    unittest.main()
