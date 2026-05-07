import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class EnvMigrationWriteUpdatesTest(unittest.TestCase):
    def test_write_env_updates_applies_multiple_keys_and_skips_empty_values(self):
        from app.core.env_migration import write_env_updates

        with tempfile.TemporaryDirectory() as tmpdir:
            env_path = os.path.join(tmpdir, ".env")
            with open(env_path, "w", encoding="utf-8") as f:
                f.write("OPENAI_MODEL=old\nKEEP=1\n")

            write_env_updates(
                env_path,
                {
                    "OPENAI_MODEL": "new-model",
                    "OPENAI_API_KEY": "secret",
                    "OPENAI_API_BASE": "",
                },
            )

            with open(env_path, "r", encoding="utf-8") as f:
                self.assertEqual(
                    f.read(),
                    "OPENAI_MODEL=new-model\nKEEP=1\nOPENAI_API_KEY=secret\n",
                )


if __name__ == "__main__":
    unittest.main()
