import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class StatusVocabularyConsistencyTest(unittest.TestCase):
    def test_runtime_and_db_default_status_use_same_idle_wording(self):
        from app.models.schemas import SystemState
        from app.services.game.session import ManualSession

        runtime_default = ManualSession().status
        db_default = SystemState.status.default.arg

        self.assertEqual(runtime_default, "空闲")
        self.assertEqual(db_default, "空闲")

    def test_system_status_enum_matches_runtime_status_vocabulary(self):
        from app.models.schemas import SystemStatus

        expected_values = {
            "空闲",
            "分析中",
            "等待开奖",
            "分析完成",
            "深度学习中",
            "等待新靴",
            "余额不足",
        }

        actual_values = {status.value for status in SystemStatus}

        self.assertSetEqual(actual_values, expected_values)
        self.assertNotIn("运行中", actual_values)
        self.assertNotIn("策略重评估中", actual_values)
        self.assertNotIn("异常处理中", actual_values)
        self.assertNotIn("洗牌等待", actual_values)


if __name__ == "__main__":
    unittest.main()
