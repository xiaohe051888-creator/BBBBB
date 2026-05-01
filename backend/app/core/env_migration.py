import os
import secrets
from typing import Callable, Dict, Tuple


KEY_WHITELIST = {
    "OPENAI_API_KEY",
    "OPENAI_MODEL",
    "OPENAI_API_BASE",
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_MODEL",
    "ANTHROPIC_API_BASE",
    "GEMINI_API_KEY",
    "GEMINI_MODEL",
    "GEMINI_API_BASE",
    "SINGLE_AI_API_KEY",
    "SINGLE_AI_MODEL",
    "SINGLE_AI_API_BASE",
    "JWT_SECRET_KEY",
}


def get_env_paths() -> Tuple[str, str]:
    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    env_path = os.path.join(backend_dir, ".env")
    legacy_path = os.path.join(backend_dir, "app", ".env")
    return env_path, legacy_path


def _parse_env(content: str) -> Dict[str, str]:
    out: Dict[str, str] = {}
    for raw in content.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        k, v = line.split("=", 1)
        k = k.strip()
        v = v.strip()
        if not k:
            continue
        out[k] = v
    return out


def merge_legacy_env(legacy_path: str, env_path: str) -> Dict[str, object]:
    if not os.path.exists(legacy_path):
        return {"migrated": False, "reason": "legacy_missing", "merged_keys": []}

    legacy_content = ""
    try:
        with open(legacy_path, "r", encoding="utf-8") as f:
            legacy_content = f.read()
    except Exception:
        return {"migrated": False, "reason": "legacy_read_failed", "merged_keys": []}

    legacy_map = {k: v for k, v in _parse_env(legacy_content).items() if k in KEY_WHITELIST and v}
    if not legacy_map:
        return {"migrated": False, "reason": "legacy_empty", "merged_keys": []}

    env_content = ""
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                env_content = f.read()
        except Exception:
            env_content = ""

    env_map = _parse_env(env_content)

    merged_keys = []
    for k, v in legacy_map.items():
        if env_map.get(k):
            continue
        env_map[k] = v
        merged_keys.append(k)

    if not merged_keys:
        return {"migrated": False, "reason": "already_present", "merged_keys": []}

    lines = []
    existing_lines = env_content.splitlines() if env_content else []
    existing_keys = set()
    for raw in existing_lines:
        line = raw.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _ = line.split("=", 1)
            existing_keys.add(k.strip())
        lines.append(raw)

    for k in sorted(merged_keys):
        if k in existing_keys:
            continue
        lines.append(f"{k}={env_map[k]}")

    try:
        with open(env_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines).rstrip() + "\n")
    except Exception:
        return {"migrated": False, "reason": "env_write_failed", "merged_keys": []}

    return {"migrated": True, "reason": "merged", "merged_keys": merged_keys}


def ensure_env_key(env_path: str, key: str, generator: Callable[[], str] | None = None) -> bool:
    existing = os.environ.get(key)
    if existing:
        return False

    if generator is None:
        def _gen() -> str:
            return secrets.token_hex(32)
        generator = _gen

    value = generator()
    os.environ[key] = value

    env_content = ""
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                env_content = f.read()
        except Exception:
            env_content = ""

    env_map = _parse_env(env_content)
    if env_map.get(key):
        return False

    lines = env_content.splitlines() if env_content else []
    lines.append(f"{key}={value}")
    with open(env_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines).rstrip() + "\n")

    return True
