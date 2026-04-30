import asyncio
import importlib
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class MigrationStrictModeTest(unittest.TestCase):
    def test_production_requires_alembic(self):
        prev_env = {
            "ENVIRONMENT": os.environ.get("ENVIRONMENT"),
            "DATABASE_URL": os.environ.get("DATABASE_URL"),
        }
        try:
            os.environ["ENVIRONMENT"] = "production"
            os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./data/strict_mode_empty.db"

            import app.core.config as cfg
            import app.core.database as db

            importlib.reload(cfg)
            importlib.reload(db)

            with self.assertRaises(RuntimeError):
                asyncio.run(db.init_db())
        finally:
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
