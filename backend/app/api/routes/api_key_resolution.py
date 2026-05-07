from app.core.config import settings


def resolve_api_key_for_role(role: str, api_key: str) -> str:
    role_map = {
        "banker": "OPENAI_API_KEY",
        "player": "ANTHROPIC_API_KEY",
        "combined": "GEMINI_API_KEY",
        "single": "SINGLE_AI_API_KEY",
    }
    if api_key:
        return api_key
    key = role_map.get(role)
    return (getattr(settings, key, "") or "") if key else ""
