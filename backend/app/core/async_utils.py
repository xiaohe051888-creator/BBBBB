import asyncio
import logging
from typing import Any, Awaitable, Coroutine, Set

_tasks: Set[asyncio.Task] = set()


async def _report_exception(name: str, err: BaseException) -> None:
    try:
        from app.core.database import async_session
        from app.services.game.logging import write_game_log

        description = f"{name}: {type(err).__name__}: {str(err)}"

        async with async_session() as s:
            await write_game_log(
                s,
                boot_number=0,
                game_number=None,
                event_code="LOG-ASYNC-001",
                event_type="后台任务异常",
                event_result="失败",
                description=description,
                category="系统异常",
                priority="P1",
                source_module="spawn_task",
            )
            await s.commit()
    except Exception:
        logging.getLogger("uvicorn.error").error("spawn_task 上报 SystemLog 失败", exc_info=True)


def spawn_task(
    coro: Awaitable[Any] | Coroutine[Any, Any, Any],
    name: str | None = None,
    report_to_system_log: bool = True,
) -> asyncio.Task:
    try:
        task = asyncio.create_task(coro, name=name) if name else asyncio.create_task(coro)
    except TypeError:
        task = asyncio.create_task(coro)
        if name:
            try:
                task.set_name(name)
            except Exception:
                pass

    _tasks.add(task)

    def _done(t: asyncio.Task) -> None:
        _tasks.discard(t)
        if t.cancelled():
            return
        try:
            t.result()
        except Exception as e:
            task_name = None
            try:
                task_name = t.get_name()
            except Exception:
                pass
            task_name = task_name or name or "spawn_task"
            logging.getLogger("uvicorn.error").error(f"后台任务异常: {task_name}", exc_info=True)
            if report_to_system_log:
                spawn_task(_report_exception(task_name, e), name="spawn_task_report", report_to_system_log=False)

    task.add_done_callback(_done)
    return task
