import os
import sys
import unittest

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.api.main import app


class CoreWritesRequireAuthTest(unittest.TestCase):
    def test_upload_requires_auth(self):
        client = TestClient(app)
        r = client.post(
            "/api/games/upload",
            json={"games": [{"game_number": 1, "result": "庄"}], "mode": "reset_current_boot"},
        )
        self.assertEqual(r.status_code, 401)

    def test_reveal_requires_auth(self):
        client = TestClient(app)
        r = client.post("/api/games/reveal", json={"game_number": 1, "result": "庄"})
        self.assertEqual(r.status_code, 401)


if __name__ == "__main__":
    unittest.main()

