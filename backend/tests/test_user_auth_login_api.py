import asyncio
import importlib
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class UserAuthLoginApiTest(unittest.TestCase):
    def test_user_login_succeeds_after_admin_creates_user(self):
        prev_env = {
            "ENVIRONMENT": os.environ.get("ENVIRONMENT"),
            "DATABASE_URL": os.environ.get("DATABASE_URL"),
        }
        try:
            os.environ["ENVIRONMENT"] = "development"
            backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
            data_dir = os.path.join(backend_dir, "data")
            os.makedirs(data_dir, exist_ok=True)
            db_path = os.path.join(data_dir, "user_login_api.db")
            if os.path.exists(db_path):
                os.remove(db_path)
            os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{db_path}"

            import app.core.config as cfg
            import app.core.database as db

            importlib.reload(cfg)
            importlib.reload(db)

            import app.models.schemas as schemas
            importlib.reload(schemas)
            from app.models.schemas import User
            from app.api.routes.schemas import UserLoginRequest
            from app.api.routes import user_auth
            importlib.reload(user_auth)

            async def _run():
                import bcrypt as _bcrypt

                await db.init_db()
                async with db.async_session() as session:
                    session.add(
                        User(
                            username="u1",
                            password_hash=_bcrypt.hashpw(b"p1", _bcrypt.gensalt()).decode("utf-8"),
                            is_active=True,
                        )
                    )
                    await session.commit()

                res = await user_auth.user_login(UserLoginRequest(username="u1", password="p1"))
                return res

            data = asyncio.run(_run())
            self.assertIn("token", data)
            self.assertEqual(data["username"], "u1")
        finally:
            try:
                import app.core.database as db

                asyncio.run(db.close_db())
            except Exception:
                pass
            for k, v in prev_env.items():
                if v is None:
                    os.environ.pop(k, None)
                else:
                    os.environ[k] = v
            import app.core.config as cfg
            import app.core.database as db

            importlib.reload(cfg)
            importlib.reload(db)


if __name__ == "__main__":
    unittest.main()
