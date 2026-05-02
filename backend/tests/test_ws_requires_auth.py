import os
import sys
import unittest

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.api.main import app


class WsRequiresAuthTest(unittest.TestCase):
    def test_ws_rejects_without_token(self):
        client = TestClient(app)
        with self.assertRaises(Exception):
            with client.websocket_connect("/ws"):
                pass


if __name__ == "__main__":
    unittest.main()

