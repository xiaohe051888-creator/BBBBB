def error_message(code: str) -> str:
    mapping = {
        "illegal_state": "当前状态不允许该操作，请刷新后重试",
        "stale_boot": "系统状态已变化，请刷新后重试",
    }
    return mapping.get(code, "请求失败，请稍后重试")

