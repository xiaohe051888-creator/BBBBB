import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.models import schemas


class UserModelAndAuditFieldsTest(unittest.TestCase):
    def test_user_model_exists(self):
        self.assertTrue(hasattr(schemas, "User"))

    def test_system_log_has_actor_fields(self):
        self.assertTrue(hasattr(schemas.SystemLog, "actor_role"))
        self.assertTrue(hasattr(schemas.SystemLog, "actor_uid"))
        self.assertTrue(hasattr(schemas.SystemLog, "actor_username"))


if __name__ == "__main__":
    unittest.main()

