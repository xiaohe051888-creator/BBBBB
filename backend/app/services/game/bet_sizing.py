import math

from app.core.config import settings


def compute_bet_amount(confidence: float, balance: float, consecutive_errors: int = 0) -> float:
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

    errors = int(consecutive_errors or 0)
    if errors < 0:
        errors = 0
    decay = float(getattr(settings, "BET_ERROR_DECAY", 0.6) or 0.6)
    decay = max(0.05, min(0.95, decay))
    raw = raw * (decay ** errors)

    ratio = float(getattr(settings, "BET_MAX_BALANCE_RATIO", 0.2) or 0.2)
    ratio = max(0.0, min(1.0, ratio))
    if bal > 0 and ratio > 0:
        raw = min(raw, bal * ratio)

    raw = max(min_bet, min(max_bet, raw))
    raw = math.floor(raw / step) * step
    if bal > 0:
        raw = min(raw, bal)
    return float(raw)
