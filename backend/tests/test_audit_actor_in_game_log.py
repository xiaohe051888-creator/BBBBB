import asyncio
import importlib
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class AuditActorInGameLogTest(unittest.TestCase):
    def test_write_game_log_includes_actor_fields_when_present(self):
        prev_env = {
            "ENVIRONMENT": os.environ.get("ENVIRONMENT"),
            "DATABASE_URL": os.environ.get("DATABASE_URL"),
        }
        try:
            os.environ["ENVIRONMENT"] = "development"
            backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
            data_dir = os.path.join(backend_dir, "data")
            os.makedirs(data_dir, exist_ok=True)
            db_path = os.path.join(data_dir, "audit_actor_log.db")
            os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{db_path}"

            import app.core.config as cfg
            import app.core.database as db

            importlib.reload(cfg)
            importlib.reload(db)

            from app.core import request_context
            from app.services.game.logging import write_game_log

            async def _run():
                await db.init_db()
                async with db.async_session() as session:
                    request_context.set_current_actor({"role": "user", "uid": 1, "username": "u1"})
                    log = await write_game_log(
                        session=session,
                        boot_number=1,
                        game_number=1,
                        event_code="TEST",
                        event_type="测试",
                        event_result="OK",
                        description="desc",
                    )
                    await session.commit()
                    return log.actor_role, log.actor_uid, log.actor_username

            role, uid, username = asyncio.run(_run())
            self.assertEqual(role, "user")
            self.assertEqual(uid, 1)
            self.assertEqual(username, "u1")
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

