import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class EnvMigrationPathsTest(unittest.TestCase):
    def test_env_paths_point_to_backend_dotenv(self):
        from app.core.env_migration import get_env_paths

        env_path, legacy_path = get_env_paths()
        self.assertTrue(env_path.endswith("/backend/.env"))
        self.assertTrue(legacy_path.endswith("/backend/app/.env"))


if __name__ == "__main__":
    unittest.main()

