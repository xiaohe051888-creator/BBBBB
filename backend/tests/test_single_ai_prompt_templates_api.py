import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class SingleAiPromptTemplatesApiTest(unittest.TestCase):
    def _ensure_admin_password(self, pwd: str) -> None:
        os.environ["ADMIN_DEFAULT_PASSWORD"] = pwd

    def test_get_and_set_single_ai_templates(self):
        from fastapi.testclient import TestClient
        from app.api.main import app

        self._ensure_admin_password("8888")
        client = TestClient(app)
        token = client.post("/api/admin/login", json={"password": "8888"}).json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        payload = {
            "prediction_template": "PRED {{BOOT_NUMBER}} {{GAME_NUMBER}} {{GAME_HISTORY}}",
            "realtime_strategy_template": "REAL {{CONSECUTIVE_ERRORS}} {{ROAD_DATA}}",
        }
        r = client.post("/api/admin/prompt-templates/single-ai", json=payload, headers=headers)
        self.assertEqual(r.status_code, 200)

        r2 = client.get("/api/admin/prompt-templates/single-ai", headers=headers)
        self.assertEqual(r2.status_code, 200)
        data = r2.json()
        self.assertEqual(data["prediction_mode"], "single_ai")
        self.assertIn("PRED", data.get("prediction_template") or "")
        self.assertIn("REAL", data.get("realtime_strategy_template") or "")


if __name__ == "__main__":
    unittest.main()

