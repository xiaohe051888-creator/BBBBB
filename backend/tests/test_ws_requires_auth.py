import os
import sys
import unittest

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.api.main import app


class WsRequiresAuthTest(unittest.TestCase):
    def test_ws_rejects_without_token(self):
        client = TestClient(app)
        with client.websocket_connect("/ws") as ws:
            ws.send_text("ping")
            with self.assertRaises(Exception):
                ws.receive_text()

    def test_ws_accepts_auth_message(self):
        client = TestClient(app)
        r = client.post("/api/admin/login", json={"password": "8888"})
        self.assertEqual(r.status_code, 200)
        token = r.json().get("token")
        self.assertTrue(isinstance(token, str) and len(token) > 10)

        with client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "auth", "token": token})
            ws.send_text("ping")
            msg = ws.receive_json()
            self.assertEqual(msg.get("type"), "pong")


if __name__ == "__main__":
    unittest.main()
