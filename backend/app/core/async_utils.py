import asyncio
from typing import Any, Awaitable, Coroutine, Set

_tasks: Set[asyncio.Task] = set()


def spawn_task(coro: Awaitable[Any] | Coroutine[Any, Any, Any]) -> asyncio.Task:
    task = asyncio.create_task(coro)
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)
    return task

