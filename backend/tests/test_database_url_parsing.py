import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class DatabaseUrlParsingTest(unittest.TestCase):
    def test_database_url_prefers_env(self):
        prev = os.environ.get("DATABASE_URL")
        try:
            os.environ["DATABASE_URL"] = "postgresql+asyncpg://user:pass@localhost:5432/db"
            from app.core.config import settings

            self.assertIn("postgresql+asyncpg://", settings.DATABASE_URL)
        finally:
            if prev is None:
                os.environ.pop("DATABASE_URL", None)
            else:
                os.environ["DATABASE_URL"] = prev

    def test_database_close_hook_exists(self):
        from app.core import database

        self.assertTrue(hasattr(database, "close_db"))


if __name__ == "__main__":
    unittest.main()
