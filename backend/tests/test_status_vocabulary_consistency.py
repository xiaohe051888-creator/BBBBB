import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class StatusVocabularyConsistencyTest(unittest.TestCase):
    def test_runtime_and_db_default_status_use_same_idle_wording(self):
        from app.models.schemas import SystemState
        from app.services.game.session import ManualSession

        runtime_default = ManualSession().status
        db_default = SystemState.status.default.arg

        self.assertEqual(runtime_default, "空闲")
        self.assertEqual(db_default, "空闲")


if __name__ == "__main__":
    unittest.main()
