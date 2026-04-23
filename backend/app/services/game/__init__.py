"""
游戏服务模块 - 百家乐手动游戏流程管理
"""
from .session import (
    ManualSession,
    get_session,
    set_broadcast_func,
    broadcast_event,
    clear_session,
)
from .logging import write_game_log
from .state import get_or_create_state, get_current_state, sync_balance_from_db
from .upload import upload_games
from .analysis import run_ai_analysis
from .betting import place_bet
from .reveal import reveal_game
from .learning import micro_learning_previous_game
from .boot import end_boot, run_deep_learning

__all__ = [
    # Session
    "ManualSession",
    "get_session",
    "set_broadcast_func",
    "broadcast_event",
    "clear_session",
    # Logging
    "write_game_log",
    # State
    "get_or_create_state",
    "get_current_state",
    "sync_balance_from_db",
    # Game Flow
    "upload_games",
    "run_ai_analysis",
    "place_bet",
    "reveal_game",
    "micro_learning_previous_game",
    "end_boot",
    "run_deep_learning",
]
