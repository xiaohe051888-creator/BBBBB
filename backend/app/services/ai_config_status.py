import hashlib


def compute_config_hash(provider: str, model: str, api_key: str, base_url: str | None) -> str:
    raw = "\n".join(
        [
            provider or "",
            model or "",
            api_key or "",
            base_url or "",
        ]
    ).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def normalize_base_url(provider: str, base_url: str | None) -> str | None:
    v = (base_url or "").strip()
    if v:
        return v
    p = (provider or "").lower()
    if p == "openai":
        return "https://api.openai.com"
    if p == "deepseek":
        return "https://api.deepseek.com"
    if p == "anthropic":
        return "https://api.anthropic.com/v1"
    if p == "aliyun":
        return "https://dashscope.aliyuncs.com/compatible-mode"
    return None
