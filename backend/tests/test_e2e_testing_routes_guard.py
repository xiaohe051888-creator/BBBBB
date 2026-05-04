import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient


class E2ERoutesGuardTest(unittest.TestCase):
    def test_routes_disabled_by_default(self):
        os.environ["E2E_TESTING"] = "false"
        from importlib import reload
        import app.core.config as cfg
        reload(cfg)
        from app.api.main import app

        c = TestClient(app)
        r = c.post("/api/admin/e2e/reset", json={"scope": "all"})
        self.assertIn(r.status_code, (404, 405))

    def test_routes_enabled_require_auth(self):
        os.environ["E2E_TESTING"] = "true"
        import sys
        from importlib import reload
        import app.core.config as cfg
        reload(cfg)
        if "app.api.main" in sys.modules:
            del sys.modules["app.api.main"]
        from app.api.main import app

        c = TestClient(app)
        r = c.post("/api/admin/e2e/reset", json={"scope": "all"})
        self.assertEqual(r.status_code, 401)


if __name__ == "__main__":
    unittest.main()
