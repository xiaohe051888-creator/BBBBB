import os
import sys
import unittest
from importlib import reload

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class ProductionDocsGuardTest(unittest.TestCase):
    def test_docs_available_outside_production(self):
        prev = os.environ.get("ENVIRONMENT")
        try:
            os.environ["ENVIRONMENT"] = "development"
            import app.core.config as cfg
            reload(cfg)
            if "app.api.main" in sys.modules:
                del sys.modules["app.api.main"]
            from app.api.main import app

            client = TestClient(app)
            res = client.get("/docs")
            self.assertEqual(res.status_code, 200)
        finally:
            if prev is None:
                os.environ.pop("ENVIRONMENT", None)
            else:
                os.environ["ENVIRONMENT"] = prev

    def test_docs_disabled_in_production(self):
        prev = {
            "ENVIRONMENT": os.environ.get("ENVIRONMENT"),
            "JWT_SECRET_KEY": os.environ.get("JWT_SECRET_KEY"),
            "AI_CONFIG_ENCRYPTION_KEY": os.environ.get("AI_CONFIG_ENCRYPTION_KEY"),
            "ADMIN_DEFAULT_PASSWORD": os.environ.get("ADMIN_DEFAULT_PASSWORD"),
            "CORS_ORIGINS": os.environ.get("CORS_ORIGINS"),
        }
        try:
            os.environ["ENVIRONMENT"] = "production"
            os.environ["JWT_SECRET_KEY"] = "jwt-secret-prod-1234567890"
            os.environ["AI_CONFIG_ENCRYPTION_KEY"] = "ai-config-secret-prod-1234567890"
            os.environ["ADMIN_DEFAULT_PASSWORD"] = "prod-admin-password-123456"
            os.environ["CORS_ORIGINS"] = "https://frontend.example.com"

            import app.core.config as cfg
            reload(cfg)
            if "app.api.main" in sys.modules:
                del sys.modules["app.api.main"]
            from app.api.main import app

            client = TestClient(app)
            res = client.get("/docs")
            self.assertEqual(res.status_code, 404)
        finally:
            for k, v in prev.items():
                if v is None:
                    os.environ.pop(k, None)
                else:
                    os.environ[k] = v


if __name__ == "__main__":
    unittest.main()
