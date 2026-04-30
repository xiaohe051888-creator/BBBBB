import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class ProdSecurityValidationTest(unittest.TestCase):
    def test_production_insecure_config_raises(self):
        prev = {
            "ENVIRONMENT": os.environ.get("ENVIRONMENT"),
            "JWT_SECRET_KEY": os.environ.get("JWT_SECRET_KEY"),
            "ADMIN_DEFAULT_PASSWORD": os.environ.get("ADMIN_DEFAULT_PASSWORD"),
            "CORS_ORIGINS": os.environ.get("CORS_ORIGINS"),
        }
        try:
            os.environ["ENVIRONMENT"] = "production"
            os.environ["JWT_SECRET_KEY"] = "change-me-in-production"
            os.environ["ADMIN_DEFAULT_PASSWORD"] = "8888"
            os.environ["CORS_ORIGINS"] = "*"

            from app.core.security import validate_production_security

            with self.assertRaises(RuntimeError):
                validate_production_security()
        finally:
            for k, v in prev.items():
                if v is None:
                    os.environ.pop(k, None)
                else:
                    os.environ[k] = v


if __name__ == "__main__":
    unittest.main()

