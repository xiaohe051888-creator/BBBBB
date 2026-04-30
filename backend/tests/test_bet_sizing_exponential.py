import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class BetSizingExponentialTest(unittest.TestCase):
    def test_bet_amount_conf_below_threshold_is_min_bet(self):
        from app.services.game.bet_sizing import compute_bet_amount
        from app.core.config import settings

        amount = compute_bet_amount(0.59, balance=1_000_000)
        self.assertEqual(amount, settings.MIN_BET)

    def test_bet_amount_conf_one_is_max_bet(self):
        from app.services.game.bet_sizing import compute_bet_amount
        from app.core.config import settings

        amount = compute_bet_amount(1.0, balance=1_000_000)
        self.assertEqual(amount, settings.MAX_BET - (settings.MAX_BET % settings.BET_STEP))

    def test_bet_amount_is_monotonic_increasing(self):
        from app.services.game.bet_sizing import compute_bet_amount

        a = compute_bet_amount(0.7, balance=1_000_000)
        b = compute_bet_amount(0.9, balance=1_000_000)
        self.assertLess(a, b)


if __name__ == "__main__":
    unittest.main()

