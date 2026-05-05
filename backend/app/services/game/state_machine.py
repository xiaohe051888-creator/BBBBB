from typing import Tuple


def can_place_bet(status: str) -> bool:
    return status in ("等待下注", "分析完成")


def can_reveal(status: str) -> bool:
    return status == "等待开奖"


def can_reset_current_boot(status: str) -> Tuple[bool, str]:
    if status == "深度学习中":
        return False, "深度学习进行中，暂不允许覆盖本靴数据"
    return True, ""
