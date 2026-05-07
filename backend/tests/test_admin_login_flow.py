import os
import sys
import unittest

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.api.main import app


class AdminLoginFlowTest(unittest.TestCase):
    def test_login_rejects_wrong_password(self):
        os.environ["ADMIN_DEFAULT_PASSWORD"] = "8888"
        with TestClient(app) as client:
            res = client.post("/api/admin/login", json={"password": "wrong"})

        self.assertEqual(res.status_code, 401)
        self.assertIn("密码错误", res.json()["detail"])

    def test_login_succeeds_with_default_password(self):
        os.environ["ADMIN_DEFAULT_PASSWORD"] = "8888"
        with TestClient(app) as client:
            res = client.post("/api/admin/login", json={"password": "8888"})

        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("token", data)
        self.assertEqual(data["username"], "admin")


if __name__ == "__main__":
    unittest.main()
