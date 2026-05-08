import base64
import hashlib
import os

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import select

from app.core.config import settings
from app.core.database import async_session
from app.models.schemas import AiModelConfig


ROLE_ENV_MAP = {
    "banker": ("OPENAI_API_KEY", "OPENAI_MODEL", "OPENAI_API_BASE"),
    "player": ("ANTHROPIC_API_KEY", "ANTHROPIC_MODEL", "ANTHROPIC_API_BASE"),
    "combined": ("GEMINI_API_KEY", "GEMINI_MODEL", "GEMINI_API_BASE"),
    "single": ("SINGLE_AI_API_KEY", "SINGLE_AI_MODEL", "SINGLE_AI_API_BASE"),
}


def _fernet_from_secret(secret: str) -> Fernet:
    key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode("utf-8")).digest())
    return Fernet(key)


def apply_single_ai_runtime_prompt_template(prompt_b64: str | None) -> None:
    value = prompt_b64 or ""
    setattr(settings, "SINGLE_AI_REALTIME_STRATEGY_PROMPT_B64", value)
    if value:
        os.environ["SINGLE_AI_REALTIME_STRATEGY_PROMPT_B64"] = value
    else:
        os.environ.pop("SINGLE_AI_REALTIME_STRATEGY_PROMPT_B64", None)


def _fernet() -> Fernet:
    secret = (
        os.getenv("AI_CONFIG_ENCRYPTION_KEY")
        or getattr(settings, "AI_CONFIG_ENCRYPTION_KEY", "")
        or os.getenv("JWT_SECRET_KEY")
        or getattr(settings, "JWT_SECRET_KEY", "")
        or "dev-ai-config-secret"
    )
    return _fernet_from_secret(secret)


def encrypt_api_key(value: str) -> str:
    if not value:
        return ""
    return _fernet().encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_api_key(value: str | None) -> str:
    if not value:
        return ""
    candidate_secrets = [
        os.getenv("AI_CONFIG_ENCRYPTION_KEY") or getattr(settings, "AI_CONFIG_ENCRYPTION_KEY", ""),
        os.getenv("JWT_SECRET_KEY") or getattr(settings, "JWT_SECRET_KEY", ""),
        "dev-ai-config-secret",
    ]
    tried: set[str] = set()
    for secret in candidate_secrets:
        if not secret or secret in tried:
            continue
        tried.add(secret)
        try:
            return _fernet_from_secret(secret).decrypt(value.encode("utf-8")).decode("utf-8")
        except (InvalidToken, ValueError, TypeError):
            continue
    return ""


def apply_ai_role_runtime_config(role: str, *, model: str, base_url: str | None, api_key: str | None) -> None:
    keys = ROLE_ENV_MAP.get(role)
    if not keys:
        return
    k_key, m_key, b_key = keys
    setattr(settings, m_key, model or "")
    os.environ[m_key] = model or ""

    setattr(settings, b_key, base_url or "")
    if base_url:
        os.environ[b_key] = base_url
    else:
        os.environ.pop(b_key, None)

    setattr(settings, k_key, api_key or "")
    if api_key:
        os.environ[k_key] = api_key
    else:
        os.environ.pop(k_key, None)


async def load_saved_ai_model_configs() -> int:
    async with async_session() as session:
        rows = (await session.execute(select(AiModelConfig))).scalars().all()

    restored = 0
    for row in rows:
        role = getattr(row, "role", "")
        if role not in ROLE_ENV_MAP:
            continue
        apply_ai_role_runtime_config(
            role,
            model=getattr(row, "model", "") or "",
            base_url=getattr(row, "base_url", "") or "",
            api_key=decrypt_api_key(getattr(row, "api_key_encrypted", "") or ""),
        )
        if role == "single":
            apply_single_ai_runtime_prompt_template(
                getattr(row, "realtime_strategy_prompt_b64", "") or ""
            )
        restored += 1
    return restored
