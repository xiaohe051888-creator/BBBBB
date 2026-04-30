import json
import os
import time
import unittest
import urllib.error
import urllib.request


BASE_URL = os.environ.get("TEST_BASE_URL", "http://localhost:8000")

def _wait_for_server(timeout_s: int = 30) -> None:
    """等待本地后端启动完成（避免 CI/脚本并发启动导致 Connection refused）"""
    deadline = time.time() + timeout_s
    last_err: Exception | None = None
    while time.time() < deadline:
        try:
            # /docs 为 HTML，不解析 JSON，仅判断能否连通即可
            req = urllib.request.Request(f"{BASE_URL}/docs", method="GET")
            with urllib.request.urlopen(req, timeout=5) as resp:
                if resp.status == 200:
                    return
            return
        except Exception as e:  # noqa: BLE001
            last_err = e
            time.sleep(0.5)


def _get_json(url: str):
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = resp.read().decode("utf-8")
        return json.loads(data)


def _post_json(url: str, payload: dict):
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read().decode("utf-8")
            return resp.status, json.loads(data)
    except urllib.error.HTTPError as e:
        data = e.read().decode("utf-8")
        return e.code, data


class UploadModesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):  # noqa: N802
        _wait_for_server()

    def test_reset_current_boot_keep_balance(self):
        state_before = _get_json(f"{BASE_URL}/api/games/current-state")
        boot_before = state_before.get("boot_number")

        payload = {
            "games": [
                {"game_number": 1, "result": "庄"},
                {"game_number": 2, "result": "闲"},
                {"game_number": 3, "result": "和"},
            ],
            "mode": "reset_current_boot",
            "balance_mode": "keep",
        }

        status, body = _post_json(f"{BASE_URL}/api/games/upload", payload)
        self.assertEqual(status, 200, body)
        self.assertIsInstance(body, dict)
        self.assertTrue(body.get("success"), body)
        if boot_before is not None:
            self.assertEqual(body.get("boot_number"), boot_before)

    def test_new_boot_skip_deep_learning(self):
        seed_payload = {
            "games": [
                {"game_number": 1, "result": "庄"},
                {"game_number": 2, "result": "闲"},
                {"game_number": 3, "result": "和"},
            ],
            "mode": "reset_current_boot",
            "balance_mode": "keep",
        }
        seed_status, seed_body = _post_json(f"{BASE_URL}/api/games/upload", seed_payload)
        self.assertEqual(seed_status, 200, seed_body)
        self.assertIsInstance(seed_body, dict)
        self.assertTrue(seed_body.get("success"), seed_body)

        state_before = _get_json(f"{BASE_URL}/api/games/current-state")
        boot_before = state_before.get("boot_number")

        payload = {
            "games": [
                {"game_number": 1, "result": "庄"},
                {"game_number": 2, "result": "闲"},
                {"game_number": 3, "result": "和"},
            ],
            "mode": "new_boot",
            "balance_mode": "keep",
            "run_deep_learning": False,
        }

        status, body = _post_json(f"{BASE_URL}/api/games/upload", payload)
        self.assertEqual(status, 200, body)
        self.assertIsInstance(body, dict)
        self.assertTrue(body.get("success"), body)
        if boot_before is not None:
            self.assertEqual(body.get("boot_number"), boot_before + 1)


if __name__ == "__main__":
    unittest.main()
