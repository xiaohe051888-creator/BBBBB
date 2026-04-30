import asyncio
import importlib
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class MigrationHeadCheckTest(unittest.TestCase):
    def test_production_revision_must_be_head(self):
        prev_env = {
            "ENVIRONMENT": os.environ.get("ENVIRONMENT"),
            "DATABASE_URL": os.environ.get("DATABASE_URL"),
        }
        try:
            db_url = "sqlite+aiosqlite:///./data/migration_head_mismatch.db"

            os.environ["ENVIRONMENT"] = "development"
            os.environ["DATABASE_URL"] = db_url
            import app.core.config as cfg
            import app.core.database as db
            import app.models.schemas as schemas

            importlib.reload(cfg)
            importlib.reload(db)

            async def _prep():
                async with db.engine.begin() as conn:
                    await conn.run_sync(db.Base.metadata.create_all)
                    await conn.execute(db.text("CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) NOT NULL)"))
                    await conn.execute(db.text("DELETE FROM alembic_version"))
                    await conn.execute(db.text("INSERT INTO alembic_version (version_num) VALUES ('20260430_0001')"))

            asyncio.run(_prep())
            asyncio.run(db.close_db())

            os.environ["ENVIRONMENT"] = "production"
            importlib.reload(cfg)
            importlib.reload(db)

            with self.assertRaises(RuntimeError):
                asyncio.run(db.init_db())
        finally:
            try:
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
