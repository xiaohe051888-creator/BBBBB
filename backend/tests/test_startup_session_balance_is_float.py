import os
import sys
import unittest

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class StartupSessionBalanceIsFloatTest(unittest.TestCase):
    def test_startup_session_balance_is_float(self):
        from app.api.main import app
        from app.services.game.session import get_session

        with TestClient(app):
            sess = get_session()
            self.assertIsInstance(sess.balance, float)


if __name__ == "__main__":
    unittest.main()

