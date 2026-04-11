"""
游戏会话管理模块
"""
import asyncio
from typing import Dict, Optional, Callable
from dataclasses import dataclass, field
from datetime import datetime

from app.core.config import settings


@dataclass
class ManualSession:
    """手动游戏会话 - 内存态，每桌一个实例"""
    table_id: str
    boot_number: int = 1
    next_game_number: int = 1           # 下一局的局号（等待开奖的局号）
    status: str = "空闲"               # 空闲/分析中/等待开奖/等待下注/深度学习中/等待新靴
    
    # 预测结果
    predict_direction: Optional[str] = None
    predict_confidence: Optional[float] = None
    predict_bet_tier: Optional[str] = None
    predict_bet_amount: Optional[float] = None
    
    # 待开奖的下注信息
    pending_bet_direction: Optional[str] = None
    pending_bet_amount: Optional[float] = None
    pending_bet_tier: Optional[str] = None
    pending_bet_time: Optional[datetime] = None
    pending_game_number: Optional[int] = None   # 等待开奖的局号
    
    # 统计
    balance: float = field(default_factory=lambda: settings.DEFAULT_BALANCE)
    consecutive_errors: int = 0
    
    # AI分析结果缓存
    banker_summary: Optional[str] = None
    player_summary: Optional[str] = None
    combined_summary: Optional[str] = None
    analysis_time: Optional[datetime] = None
    
    # 深度学习状态
    deep_learning_status: Optional[Dict] = None  # 深度学习进度状态


# 全局会话管理器
_sessions: Dict[str, ManualSession] = {}
# WebSocket广播函数（由main.py注入）
_broadcast_func: Optional[Callable] = None


def get_session(table_id: str) -> ManualSession:
    """获取或创建桌子的会话"""
    if table_id not in _sessions:
        _sessions[table_id] = ManualSession(table_id=table_id)
    return _sessions[table_id]


def set_broadcast_func(func: Callable):
    """注入WebSocket广播函数"""
    global _broadcast_func
    _broadcast_func = func


async def broadcast_event(table_id: str, event_type: str, data: Dict):
    """广播事件到WebSocket"""
    if _broadcast_func:
        await _broadcast_func(table_id, event_type, data)


def get_all_sessions() -> Dict[str, ManualSession]:
    """获取所有会话（用于管理）"""
    return _sessions.copy()


def clear_session(table_id: str):
    """清除指定桌子的会话"""
    if table_id in _sessions:
        del _sessions[table_id]
