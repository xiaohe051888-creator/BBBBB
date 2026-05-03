import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class ApiConfigTestKeyResolutionTest(unittest.TestCase):
    def test_resolve_api_key_for_role_prefers_payload(self):
        from app.api.routes.auth import resolve_api_key_for_role
        self.assertEqual(resolve_api_key_for_role("single", "k1"), "k1")

    def test_resolve_api_key_for_role_falls_back_to_settings(self):
        from app.api.routes.auth import resolve_api_key_for_role
        from app.core.config import settings

        old = getattr(settings, "SINGLE_AI_API_KEY", "")
        try:
            setattr(settings, "SINGLE_AI_API_KEY", "saved")
            self.assertEqual(resolve_api_key_for_role("single", ""), "saved")
        finally:
            setattr(settings, "SINGLE_AI_API_KEY", old)


if __name__ == "__main__":
    unittest.main()

