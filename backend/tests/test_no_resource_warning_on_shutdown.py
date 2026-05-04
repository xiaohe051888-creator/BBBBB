import os
import sys
import unittest
import warnings

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class NoResourceWarningOnShutdownTest(unittest.TestCase):
    def test_no_resource_warning_on_shutdown(self):
        from app.api.main import app

        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always", ResourceWarning)
            with TestClient(app):
                pass

        resource_warnings = [x for x in w if issubclass(x.category, ResourceWarning)]
        self.assertEqual(resource_warnings, [])


if __name__ == "__main__":
    unittest.main()

