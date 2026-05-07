from typing import Any


def build_startup_session_seed(
    state: Any,
    normalized_mode: str | None = None,
    max_game_number: int | None = None,
) -> dict[str, int | float | str]:
    fallback_next_game_number = (getattr(state, "game_number", 0) or 0) + 1

    return {
        "balance": float(getattr(state, "balance", 0) or 0),
        "boot_number": getattr(state, "boot_number", 0) or 1,
        "next_game_number": (max_game_number + 1) if max_game_number is not None else fallback_next_game_number,
        "consecutive_errors": getattr(state, "consecutive_errors", 0) or 0,
        "prediction_mode": normalized_mode or getattr(state, "prediction_mode", None) or "rule",
    }
