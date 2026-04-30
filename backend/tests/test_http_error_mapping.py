import os
import sys
import unittest


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class HttpErrorMappingTest(unittest.TestCase):
    def test_upload_illegal_state_maps_to_409_and_human_message(self):
        from app.api.routes.game import _upload_error_to_http_exception

        exc = _upload_error_to_http_exception(
            {"success": False, "error": "illegal_state", "message": "当前状态(等待开奖)不允许覆盖本靴数据"}
        )
        self.assertEqual(exc.status_code, 409)
        self.assertEqual(exc.detail, "当前状态(等待开奖)不允许覆盖本靴数据")

    def test_reveal_illegal_state_maps_to_409_and_human_message(self):
        from app.api.routes.game import _reveal_error_to_http_exception

        exc = _reveal_error_to_http_exception(
            {"success": False, "error": "illegal_state", "message": "当前状态(分析中)无法录入开奖结果"}
        )
        self.assertEqual(exc.status_code, 409)
        self.assertEqual(exc.detail, "当前状态(分析中)无法录入开奖结果")


if __name__ == "__main__":
    unittest.main()

