import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Coroutine, Dict, Optional, Awaitable, Union
from uuid import uuid4
from app.services.game.task_context import current_task_id
from app.core.async_utils import spawn_task

logger = logging.getLogger(__name__)


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
    task: Optional[asyncio.Task]
    coro_obj: Optional[object]


class TaskRegistry:
    def __init__(self) -> None:
        self._tasks: Dict[str, RegisteredTask] = {}
        self._by_key: Dict[str, str] = {}

    async def _persist_create(self, meta: RegisteredTask) -> None:
        from sqlalchemy import select
        from sqlalchemy.exc import IntegrityError
        from app.core.database import async_session
        from app.models.schemas import BackgroundTask

        async with async_session() as db:
            existing = await db.execute(select(BackgroundTask).where(BackgroundTask.task_id == meta.task_id))
            row = existing.scalar_one_or_none()
            if not row:
                row = BackgroundTask(
                    task_id=meta.task_id,
                    task_type=meta.task_type,
                    boot_number=meta.boot_number,
                    dedupe_key=meta.dedupe_key,
                    status=meta.status,
                    message=meta.message,
                    error=meta.error,
                )
                db.add(row)
            else:
                row.status = meta.status
                row.message = meta.message
                row.error = meta.error
            try:
                await db.commit()
            except IntegrityError:
                await db.rollback()
                existing = await db.execute(select(BackgroundTask).where(BackgroundTask.task_id == meta.task_id))
                row = existing.scalar_one_or_none()
                if row:
                    row.status = meta.status
                    row.message = meta.message
                    row.error = meta.error
                    await db.commit()

    async def _persist_finish(self, meta: RegisteredTask) -> None:
        from sqlalchemy import select, delete
        from sqlalchemy.exc import IntegrityError
        from app.core.database import async_session
        from app.models.schemas import BackgroundTask
        from datetime import datetime as _dt

        async with async_session() as db:
            existing = await db.execute(select(BackgroundTask).where(BackgroundTask.task_id == meta.task_id))
            row = existing.scalar_one_or_none()
            if not row:
                row = BackgroundTask(
                    task_id=meta.task_id,
                    task_type=meta.task_type,
                    boot_number=meta.boot_number,
                    dedupe_key=meta.dedupe_key,
                    status=meta.status,
                    message=meta.message,
                    error=meta.error,
                    finished_at=_dt.now(),
                )
                db.add(row)
            else:
                row.status = meta.status
                row.message = meta.message
                row.error = meta.error
                row.finished_at = _dt.now()

            try:
                await db.commit()
            except IntegrityError:
                await db.rollback()
                existing = await db.execute(select(BackgroundTask).where(BackgroundTask.task_id == meta.task_id))
                row = existing.scalar_one_or_none()
                if row:
                    row.status = meta.status
                    row.message = meta.message
                    row.error = meta.error
                    row.finished_at = _dt.now()
                    await db.commit()

            keep = 1000
            ids = (await db.execute(
                select(BackgroundTask.task_id).order_by(BackgroundTask.created_at.desc()).offset(keep)
            )).scalars().all()
            if ids:
                await db.execute(delete(BackgroundTask).where(BackgroundTask.task_id.in_(ids)))
                await db.commit()

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
        meta = RegisteredTask(
            task_id=task_id,
            task_type=task_type,
            boot_number=boot_number,
            dedupe_key=dedupe_key,
            created_at=datetime.now().isoformat(),
            status="running",
            message="运行中",
            error=None,
            task=None,
            coro_obj=None,
        )
        self._tasks[task_id] = meta
        if dedupe_key:
            self._by_key[dedupe_key] = task_id

        if isinstance(coro, asyncio.Task):
            meta.task = coro
            try:
                spawn_task(self._persist_create(meta))
            except RuntimeError:
                pass

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

                async def _persist() -> None:
                    try:
                        await self._persist_finish(meta)
                    except Exception:
                        logger.exception("持久化任务完成状态失败: task_id=%s task_type=%s", meta.task_id, meta.task_type)

                try:
                    spawn_task(_persist())
                except RuntimeError:
                    pass

            coro.add_done_callback(_done)
            return meta

        meta.coro_obj = coro

        async def _runner():
            token = current_task_id.set(meta.task_id)
            try:
                await self._persist_create(meta)
                meta.coro_obj = None
                await coro
                meta.status = "succeeded"
                meta.message = "已完成"
                await self._persist_finish(meta)
            except asyncio.CancelledError:
                meta.status = "cancelled"
                meta.message = "已取消"
                try:
                    if hasattr(coro, "close"):
                        coro.close()
                except Exception:
                    pass
                meta.coro_obj = None
                try:
                    await asyncio.shield(self._persist_finish(meta))
                except Exception:
                    logger.exception("持久化任务取消状态失败: task_id=%s task_type=%s", meta.task_id, meta.task_type)
                raise
            except Exception as e:
                meta.status = "failed"
                meta.message = "执行失败"
                meta.error = str(e)[:200]
                try:
                    if hasattr(coro, "close"):
                        coro.close()
                except Exception:
                    pass
                meta.coro_obj = None
                await self._persist_finish(meta)
                raise
            finally:
                current_task_id.reset(token)

        meta.task = spawn_task(_runner())

        def _finalize(_: asyncio.Task) -> None:
            try:
                if meta.coro_obj and hasattr(meta.coro_obj, "close"):
                    meta.coro_obj.close()
            except Exception:
                pass
            meta.coro_obj = None

        meta.task.add_done_callback(_finalize)
        return meta

    def cancel(self, task_id: str) -> bool:
        meta = self._tasks.get(task_id)
        if not meta or meta.status != "running":
            return False
        meta.status = "cancelled"
        meta.message = "已取消"
        try:
            if meta.coro_obj and hasattr(meta.coro_obj, "close"):
                meta.coro_obj.close()
        except Exception:
            pass
        meta.coro_obj = None
        if meta.task:
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
