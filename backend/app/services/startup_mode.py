from typing import Mapping, Literal


PredictionMode = Literal["ai", "single_ai", "rule"]


def is_secret_configured(v: str | None, min_len: int = 10) -> bool:
    return bool(v and isinstance(v, str) and len(v) > min_len)


def normalize_startup_prediction_mode(
    current_mode: str | None,
    secrets_by_key: Mapping[str, str | None],
) -> PredictionMode:
    mode = (current_mode or "rule")

    if mode == "ai":
        ready = all(
            is_secret_configured(secrets_by_key.get(key, ""))
            for key in ("OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY")
        )
        return "ai" if ready else "rule"

    if mode == "single_ai":
        ready = is_secret_configured(secrets_by_key.get("SINGLE_AI_API_KEY", ""))
        return "single_ai" if ready else "rule"

    return "rule"
