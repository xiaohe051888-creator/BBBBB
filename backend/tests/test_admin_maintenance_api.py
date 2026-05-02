import os
import sys
import unittest

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.api.main import app


class AdminMaintenanceApiTest(unittest.TestCase):
    def test_stats_requires_auth(self):
        client = TestClient(app)
        r = client.get("/api/admin/maintenance/stats")
        self.assertEqual(r.status_code, 401)

    def test_stats_and_alerts_work_with_token(self):
        client = TestClient(app)
        token = client.post("/api/admin/login", json={"password": "8888"}).json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        r = client.get("/api/admin/maintenance/stats", headers=headers)
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertIn("counts", body)
        self.assertIn("config", body)

        r2 = client.get("/api/admin/maintenance/alerts", headers=headers)
        self.assertEqual(r2.status_code, 200)
        self.assertIn("count", r2.json())

    def test_retention_run_returns_summary(self):
        client = TestClient(app)
        token = client.post("/api/admin/login", json={"password": "8888"}).json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        r = client.post("/api/admin/maintenance/retention/run", headers=headers)
        self.assertEqual(r.status_code, 200)
        self.assertIn("deleted", r.json())


if __name__ == "__main__":
    unittest.main()

