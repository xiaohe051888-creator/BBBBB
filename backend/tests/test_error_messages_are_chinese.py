import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class ErrorMessagesChineseTest(unittest.TestCase):
    def test_http_exception_detail_should_not_be_raw_code(self):
        from app.api.routes.game import _upload_error_to_http_exception

        exc = _upload_error_to_http_exception({"success": False, "error": "stale_boot"})
        self.assertNotEqual(exc.detail, "stale_boot")


if __name__ == "__main__":
    unittest.main()

