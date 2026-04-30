import asyncio
from dataclasses import dataclass
from datetime import datetime
from typing import Coroutine, Dict, Optional, Awaitable, Union
from uuid import uuid4


@dataclass
class RegisteredTask:
    task_id: str
    task_type: str
    boot_number: Optional[int]
    dedupe_key: Optional[str]
    created_at: str
    status: str
    message: str
    error: Optional[str]
    task: asyncio.Task


class TaskRegistry:
    def __init__(self) -> None:
        self._tasks: Dict[str, RegisteredTask] = {}
        self._by_key: Dict[str, str] = {}

    def create(
        self,
        task_type: str,
        coro: Union[Coroutine, Awaitable, asyncio.Task],
        boot_number: Optional[int] = None,
        dedupe_key: Optional[str] = None,
    ) -> RegisteredTask:
        if dedupe_key and dedupe_key in self._by_key:
            existing_id = self._by_key[dedupe_key]
            existing = self._tasks.get(existing_id)
            if existing and existing.status == "running":
                try:
                    if hasattr(coro, "close") and not isinstance(coro, asyncio.Task):
                        coro.close()
                except Exception:
                    pass
                return existing

        task_id = str(uuid4())
        if isinstance(coro, asyncio.Task):
            task = coro
        else:
            task = asyncio.create_task(coro)
        meta = RegisteredTask(
            task_id=task_id,
            task_type=task_type,
            boot_number=boot_number,
            dedupe_key=dedupe_key,
            created_at=datetime.now().isoformat(),
            status="running",
            message="运行中",
            error=None,
            task=task,
        )
        self._tasks[task_id] = meta
        if dedupe_key:
            self._by_key[dedupe_key] = task_id

        def _done(t: asyncio.Task) -> None:
            try:
                if t.cancelled():
                    meta.status = "cancelled"
                    meta.message = "已取消"
                else:
                    t.result()
                    meta.status = "succeeded"
                    meta.message = "已完成"
            except Exception as e:
                meta.status = "failed"
                meta.message = "执行失败"
                meta.error = str(e)[:200]

        task.add_done_callback(_done)
        return meta

    def cancel(self, task_id: str) -> bool:
        meta = self._tasks.get(task_id)
        if not meta or meta.status != "running":
            return False
        meta.status = "cancelled"
        meta.message = "已取消"
        meta.task.cancel()
        return True

    def list(self, limit: int = 50) -> list[dict]:
        items = list(self._tasks.values())
        items.sort(key=lambda x: x.created_at, reverse=True)
        return [
            {
                "task_id": t.task_id,
                "task_type": t.task_type,
                "boot_number": t.boot_number,
                "dedupe_key": t.dedupe_key,
                "created_at": t.created_at,
                "status": t.status,
                "message": t.message,
                "error": t.error,
            }
            for t in items[:limit]
        ]


registry = TaskRegistry()
