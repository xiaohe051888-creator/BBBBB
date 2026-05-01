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
    """游戏会话 - 内存态，全局单例"""
    boot_number: int = 1
    next_game_number: int = 1           # 下一局的局号（等待开奖的局号）
    status: str = "空闲"               # 空闲/分析中/等待开奖/分析完成/深度学习中/等待新靴
    prediction_mode: str = "ai"        # 'ai' | 'single_ai' | 'rule'

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


# 全局单例会话和锁
_session: Optional[ManualSession] = None
# 全局内存锁 (懒加载，避免跨事件循环问题)
_session_lock = None
# 后台任务强引用集合，防止被垃圾回收
_background_tasks = set()
# WebSocket广播函数（由main.py注入）
_broadcast_func: Optional[Callable] = None
_allowed_task_types = {
    "analysis",
    "deep_learning",
    "micro_learning",
    "ai_learning",
    "background",
}
_task_semaphores: dict[str, asyncio.Semaphore] = {
    "analysis": asyncio.Semaphore(1),
    "deep_learning": asyncio.Semaphore(1),
    "micro_learning": asyncio.Semaphore(1),
    "ai_learning": asyncio.Semaphore(1),
    "default": asyncio.Semaphore(settings.DEFAULT_TASK_CONCURRENCY),
}


def add_background_task(task):
    """保存后台任务的强引用"""
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)

    return task


def start_background_task(
    task_type: str,
    coro,
    boot_number: Optional[int] = None,
    dedupe_key: Optional[str] = None,
):
    from app.services.game.task_registry import registry

    if task_type not in _allowed_task_types:
        raise ValueError(f"非法 task_type: {task_type}")

    sem = _task_semaphores.get(task_type) or _task_semaphores["default"]
    if sem:
        orig = coro

        async def _wrapped():
            await sem.acquire()
            try:
                return await orig
            finally:
                sem.release()

        coro = _wrapped()

    meta = registry.create(
        task_type=task_type,
        coro=coro,
        boot_number=boot_number,
        dedupe_key=dedupe_key,
    )
    if meta.task:
        add_background_task(meta.task)
    return meta


def list_background_tasks(limit: int = 50) -> list[dict]:
    from app.services.game.task_registry import registry

    return registry.list(limit=limit)


def get_session() -> ManualSession:
    """获取单例会话（不带锁，仅供只读或已加锁环境下使用）"""
    global _session
    if _session is None:
        _session = ManualSession()
    return _session


def get_session_lock() -> asyncio.Lock:
    """获取全局内存锁（安全的惰性初始化）"""
    global _session_lock
    if _session_lock is None:
        _session_lock = asyncio.Lock()
    return _session_lock


def set_broadcast_func(func: Callable):
    """注入WebSocket广播函数"""
    global _broadcast_func
    _broadcast_func = func


async def broadcast_event(event_type: str, data: Dict):
    """广播事件到WebSocket"""
    if _broadcast_func:
        await _broadcast_func(event_type, data)


def clear_session():
    """重置单例会话"""
    global _session
    _session = ManualSession()
