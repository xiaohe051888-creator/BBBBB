import os
import sys
import unittest

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class LifespanCancelsSpawnedTasksTest(unittest.TestCase):
    def test_lifespan_cancels_spawned_tasks(self):
        from app.api.main import app
        from app.core.async_utils import _tasks

        with TestClient(app):
            self.assertGreaterEqual(len(_tasks), 0)

        self.assertEqual(len(_tasks), 0)


if __name__ == "__main__":
    unittest.main()

