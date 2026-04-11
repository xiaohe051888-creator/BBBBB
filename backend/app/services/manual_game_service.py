"""
手动游戏管理服务 - 百家乐分析预测系统
替代原WorkflowEngine，管理手动上传→AI预测→下注→开奖→结算的完整流程

注意：此文件现在是兼容层，实际实现已拆分到 game/ 子模块
"""
# 为了保持向后兼容，从子模块重新导出所有功能
from app.services.game import (
    # 数据类
    ManualSession,
    # 会话管理
    get_session,
    set_broadcast_func,
    # 日志
    write_game_log,
    # 状态管理
    get_or_create_state,
    get_current_state,
    sync_balance_from_db,
    # 核心业务流程
    upload_games,
    run_ai_analysis,
    place_bet,
    reveal_game,
    micro_learning_previous_game,
    end_boot,
    run_deep_learning,
)

__all__ = [
    "ManualSession",
    "get_session",
    "set_broadcast_func",
    "write_game_log",
    "get_or_create_state",
    "get_current_state",
    "sync_balance_from_db",
    "upload_games",
    "run_ai_analysis",
    "place_bet",
    "reveal_game",
    "micro_learning_previous_game",
    "end_boot",
    "run_deep_learning",
]
