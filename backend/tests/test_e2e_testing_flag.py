import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class E2ETestingFlagTest(unittest.TestCase):
    def test_e2e_testing_flag_parsing(self):
        os.environ["E2E_TESTING"] = "true"
        from importlib import reload
        import app.core.config as cfg
        reload(cfg)
        self.assertTrue(cfg.settings.E2E_TESTING)


if __name__ == "__main__":
    unittest.main()

