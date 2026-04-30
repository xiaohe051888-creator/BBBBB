import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class StateMachineRulesTest(unittest.TestCase):
    def test_rules_expose_allowed_actions(self):
        from app.services.game.state_machine import can_place_bet, can_reveal, can_reset_current_boot

        self.assertTrue(can_place_bet("等待下注"))
        self.assertFalse(can_place_bet("等待开奖"))
        self.assertTrue(can_reveal("等待开奖"))
        self.assertFalse(can_reveal("分析中"))

        ok, msg = can_reset_current_boot("空闲")
        self.assertTrue(ok)
        self.assertEqual(msg, "")

        ok, msg = can_reset_current_boot("深度学习中")
        self.assertFalse(ok)
        self.assertNotEqual(msg, "")


if __name__ == "__main__":
    unittest.main()

