import os
import sys
import unittest

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.api.main import app


class WsHttpUpgradeRequiredTest(unittest.TestCase):
    def test_ws_http_get_returns_426(self):
        client = TestClient(app)
        r = client.get("/ws")
        self.assertEqual(r.status_code, 426)


if __name__ == "__main__":
    unittest.main()

