from contextvars import ContextVar
from typing import Optional

current_task_id: ContextVar[Optional[str]] = ContextVar("current_task_id", default=None)

