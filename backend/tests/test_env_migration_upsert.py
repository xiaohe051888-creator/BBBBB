import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class EnvMigrationUpsertTest(unittest.TestCase):
    def test_upsert_env_value_replaces_once_and_appends_missing_key(self):
        from app.core.env_migration import upsert_env_value

        content = "FOO=1\nBAR=2\nFOO=old\n"
        updated = upsert_env_value(content, "FOO", "9")
        updated = upsert_env_value(updated, "BAZ", "3")

        self.assertEqual(updated, "FOO=9\nBAR=2\nBAZ=3\n")


if __name__ == "__main__":
    unittest.main()
