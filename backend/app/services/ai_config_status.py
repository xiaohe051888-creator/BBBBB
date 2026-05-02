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

