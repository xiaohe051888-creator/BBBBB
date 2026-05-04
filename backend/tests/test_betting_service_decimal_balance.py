import os
import sys
import unittest
from decimal import Decimal

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class BettingServiceDecimalBalanceTest(unittest.TestCase):
    def test_settle_bet_with_decimal_balance(self):
        from app.services.betting_service import BettingService

        svc = BettingService()
        svc.set_balance(Decimal("20000"))
        svc.place_bet(game_number=1, direction="庄", amount=10.0)
        r = svc.settle_bet(bet_direction="庄", bet_amount=10.0, game_result="庄")
        self.assertEqual(r["status"], "已结算")


if __name__ == "__main__":
    unittest.main()

