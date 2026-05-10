from typing import Any

from app.services.ai_config_status import normalize_base_url


SINGLE_AI_PROVIDER = "deepseek"
SINGLE_AI_MODEL = "deepseek-v4-pro"
SINGLE_AI_OFFICIAL_BASE_URL = "https://api.deepseek.com"


def normalize_single_ai_base_url(base_url: str | None) -> str:
    normalized = normalize_base_url(SINGLE_AI_PROVIDER, base_url) or SINGLE_AI_OFFICIAL_BASE_URL
    return normalized.rstrip("/")


def build_single_ai_runtime_config(
    provider: str,
    model: str,
    base_url: str | None,
    api_key: str,
) -> dict[str, Any]:
    normalized_base_url = normalize_single_ai_base_url(base_url)
    return {
        "provider": SINGLE_AI_PROVIDER,
        "model": SINGLE_AI_MODEL,
        "normalized_base_url": normalized_base_url,
        "chat_completions_url": f"{normalized_base_url}/chat/completions",
        "api_key": api_key,
        "thinking": {"type": "enabled"},
    }


def build_single_ai_test_payload() -> dict[str, Any]:
    return {
        "model": SINGLE_AI_MODEL,
        "messages": [
            {
                "role": "user",
                "content": (
                    "你是百家乐单AI预测引擎，请基于简化样本给出下一局判断。"
                    "你可以先内部思考，但最终只输出严格 JSON，不要输出 Markdown，不要输出代码块。"
                    '{"final_prediction":"庄或闲","confidence":0-1,"bet_tier":"保守/标准/激进","summary":"一句话摘要","reasoning_points":["要点1"],"reasoning_detail":"详细推理"}'
                ),
            }
        ],
        "max_tokens": 300,
        "temperature": 0.2,
        "thinking": {"type": "enabled"},
    }
