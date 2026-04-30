import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class DatabaseUrlParsingTest(unittest.TestCase):
    def test_database_url_prefers_env(self):
        os.environ["DATABASE_URL"] = "postgresql+asyncpg://user:pass@localhost:5432/db"
        from app.core.config import settings

        self.assertIn("postgresql+asyncpg://", settings.DATABASE_URL)

    def test_database_close_hook_exists(self):
        from app.core import database

        self.assertTrue(hasattr(database, "close_db"))


if __name__ == "__main__":
    unittest.main()

