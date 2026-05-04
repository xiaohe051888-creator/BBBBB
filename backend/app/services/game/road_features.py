from __future__ import annotations

from typing import Any

from fastapi.encoders import jsonable_encoder


def _clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    if v < lo:
        return lo
    if v > hi:
        return hi
    return v


def _to_values(points: list[dict[str, Any]]) -> list[str]:
    if not points:
        return []
    if all(isinstance(p, dict) and "game_number" in p for p in points):
        pts = sorted(points, key=lambda x: (x.get("game_number") or 0))
    else:
        pts = points
    values: list[str] = []
    for p in pts:
        if not isinstance(p, dict):
            continue
        v = p.get("value")
        if isinstance(v, str) and v:
            values.append(v)
    return values


def _run_length(values: list[str]) -> int:
    if not values:
        return 0
    last = values[-1]
    n = 0
    for v in reversed(values):
        if v != last:
            break
        n += 1
    return n


def _switches(values: list[str]) -> int:
    if len(values) <= 1:
        return 0
    s = 0
    prev = values[0]
    for v in values[1:]:
        if v != prev:
            s += 1
        prev = v
    return s


def _signal_strength(run_len: int, switches_last_12: int) -> float:
    rl = _clamp(run_len / 6.0, 0.0, 1.0)
    sw = _clamp(1.0 - (switches_last_12 / 11.0), 0.0, 1.0)
    return _clamp(rl * 0.6 + sw * 0.4, 0.0, 1.0)


def _break_risk(switches_last_12: int, run_len: int) -> str:
    if switches_last_12 >= 8:
        return "high"
    if switches_last_12 >= 5:
        return "medium"
    if run_len >= 6:
        return "medium"
    return "low"


def _vote_from_ratio(diff: int, threshold: int = 2) -> int:
    if diff >= threshold:
        return 1
    if diff <= -threshold:
        return -1
    return 0


def build_road_features(
    boot_number: int,
    game_number: int,
    game_history: list[dict[str, Any]],
    road_data: dict[str, Any],
) -> dict[str, Any]:
    encoded_roads = jsonable_encoder(road_data) if road_data is not None else {}
    roads_present = ["big_road", "bead_road", "big_eye", "small_road", "cockroach_road"]

    history_results: list[str] = []
    banker_count = 0
    player_count = 0
    for r in game_history or []:
        if not isinstance(r, dict):
            continue
        res = r.get("result")
        if res not in ("庄", "闲"):
            continue
        history_results.append(res)
        if res == "庄":
            banker_count += 1
        else:
            player_count += 1

    recent_12 = history_results[-12:]
    recent_12_b = sum(1 for x in recent_12 if x == "庄")
    recent_12_p = sum(1 for x in recent_12 if x == "闲")
    recent_12_diff = recent_12_b - recent_12_p

    base_last_dir = history_results[-1] if history_results else "庄"

    per_road: dict[str, Any] = {}
    vote_detail: dict[str, int] = {}

    for k in roads_present:
        rd = encoded_roads.get(k) or {}
        points = rd.get("points") or []
        values = _to_values(points if isinstance(points, list) else [])
        last_value = values[-1] if values else None
        run_len = _run_length(values)
        last_12_values = values[-12:]
        sw12 = _switches(last_12_values)
        strength = _signal_strength(run_len, sw12)
        br = _break_risk(sw12, run_len)

        vote = 0
        if k in ("big_road", "bead_road"):
            if k == "big_road":
                diff = recent_12_diff
            else:
                diff = recent_12_diff
            vote = _vote_from_ratio(diff, threshold=2)
        else:
            last_24 = values[-24:]
            red = sum(1 for x in last_24 if x == "红")
            blue = sum(1 for x in last_24 if x == "蓝")
            total = red + blue
            red_ratio = (red / total) if total else 0.0
            if total >= 6:
                if red_ratio >= 0.65:
                    vote = 1 if base_last_dir == "庄" else -1
                elif red_ratio <= 0.35:
                    vote = -1 if base_last_dir == "庄" else 1
                else:
                    vote = 0

        vote_detail[k] = int(vote)
        per_road[k] = {
            "display_name": rd.get("display_name") or k,
            "points_count": int(len(values)),
            "last_value": last_value,
            "run_length": int(run_len),
            "switches_last_12": int(sw12),
            "signal_strength": float(strength),
            "break_risk": br,
        }
        if k in ("big_eye", "small_road", "cockroach_road"):
            last_24 = values[-24:]
            red = sum(1 for x in last_24 if x == "红")
            blue = sum(1 for x in last_24 if x == "蓝")
            total = red + blue
            per_road[k]["red_ratio_last_24"] = float((red / total) if total else 0.0)
        per_road[k]["vote"] = int(vote)

    score = sum(vote_detail.values())
    conflict_score = 1.0 - (abs(score) / 5.0)
    conflict_score = _clamp(conflict_score, 0.0, 1.0)

    return {
        "boot_number": int(boot_number),
        "game_number": int(game_number),
        "roads_present": roads_present,
        "history_stats": {
            "total_non_tie": int(len(history_results)),
            "banker_count": int(banker_count),
            "player_count": int(player_count),
            "banker_ratio": float((banker_count / len(history_results)) if history_results else 0.0),
            "recent_non_tie_tail": history_results[-12:],
        },
        "per_road": per_road,
        "ensemble": {
            "score": int(score),
            "conflict_score": float(conflict_score),
            "vote_detail": vote_detail,
        },
    }

