from typing import Any, Mapping

from app.services.startup_mode import normalize_startup_prediction_mode


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


def apply_startup_session_seed(session: Any, seed: dict[str, int | float | str]) -> None:
    if "balance" in seed:
        session.balance = float(seed["balance"])
    if "boot_number" in seed:
        session.boot_number = int(seed["boot_number"])
    if "next_game_number" in seed:
        session.next_game_number = int(seed["next_game_number"])
    if "consecutive_errors" in seed:
        session.consecutive_errors = int(seed["consecutive_errors"])
    if "prediction_mode" in seed:
        session.prediction_mode = str(seed["prediction_mode"])


def resolve_startup_session_seed(
    state: Any,
    secrets_by_key: Mapping[str, str | None],
    max_game_number: int | None = None,
) -> dict[str, int | float | str]:
    normalized_mode = normalize_startup_prediction_mode(
        getattr(state, "prediction_mode", None) if state else None,
        secrets_by_key,
    )
    if not state:
        return {"prediction_mode": normalized_mode}
    return build_startup_session_seed(
        state,
        normalized_mode=normalized_mode,
        max_game_number=max_game_number,
    )
