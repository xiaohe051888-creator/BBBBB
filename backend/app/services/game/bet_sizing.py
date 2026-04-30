import math

from app.core.config import settings


def compute_bet_amount(confidence: float, balance: float) -> float:
    conf = float(confidence) if confidence is not None else 0.0
    if math.isnan(conf) or math.isinf(conf):
        conf = 0.0
    conf = max(0.0, min(1.0, conf))

    bal = float(balance) if balance is not None else 0.0
    if math.isnan(bal) or math.isinf(bal) or bal < 0:
        bal = 0.0

    c0 = float(settings.BET_CONF_THRESHOLD)
    gamma = float(settings.BET_EXP_GAMMA)
    c0 = max(0.0, min(0.99, c0))
    gamma = max(0.1, gamma)

    min_bet = float(settings.MIN_BET)
    max_bet = float(settings.MAX_BET)
    step = float(settings.BET_STEP)
    if step <= 0:
        step = 1.0

    if conf < c0:
        raw = min_bet
    else:
        x = (conf - c0) / (1.0 - c0)
        raw = min_bet + (max_bet - min_bet) * (x ** gamma)

    raw = max(min_bet, min(max_bet, raw))
    raw = math.floor(raw / step) * step
    if bal > 0:
        raw = min(raw, bal)
    return float(raw)

