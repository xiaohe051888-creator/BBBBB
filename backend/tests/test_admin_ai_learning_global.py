import json
import os
import time
import unittest
import urllib.error
import urllib.request


BASE_URL = os.environ.get("TEST_BASE_URL", "http://localhost:8000")


def _wait_for_server(timeout_s: int = 30) -> None:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        try:
            req = urllib.request.Request(f"{BASE_URL}/docs", method="GET")
            with urllib.request.urlopen(req, timeout=5) as resp:
                if resp.status == 200:
                    return
        except Exception:
            time.sleep(0.5)


def _post_json(url: str, payload: dict | None, headers: dict | None = None):
    body = b"" if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json", **(headers or {})},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read().decode("utf-8")
            return resp.status, json.loads(data)
    except urllib.error.HTTPError as e:
        data = e.read().decode("utf-8")
        return e.code, data


class AdminLearningGlobalTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):  # noqa: N802
        _wait_for_server()

    def test_start_global_learning(self):
        payload = {
            "games": [{"game_number": i + 1, "result": "庄"} for i in range(20)],
            "mode": "reset_current_boot",
            "balance_mode": "keep",
        }
        seed_status, seed_body = _post_json(f"{BASE_URL}/api/games/upload", payload)
        self.assertEqual(seed_status, 200, seed_body)
        self.assertIsInstance(seed_body, dict)
        self.assertTrue(seed_body.get("success"), seed_body)

        status, login = _post_json(f"{BASE_URL}/api/admin/login", {"password": "8888"})
        self.assertEqual(status, 200, login)
        token = login["token"]

        status2, body2 = _post_json(
            f"{BASE_URL}/api/admin/ai-learning/start?boot_number=0",
            None,
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(status2, 200, body2)
        if isinstance(body2, dict):
            self.assertIn("message", body2)


if __name__ == "__main__":
    unittest.main()

