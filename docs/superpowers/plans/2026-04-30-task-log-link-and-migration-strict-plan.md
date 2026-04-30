# 任务-日志关联 + 迁移严格模式 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让后台任务与系统日志可追溯关联，并在生产环境启用迁移严格模式，禁止自动建表/自动加字段。

**Architecture:** 在 SystemLog 增加 `task_id` 字段并以 Alembic 迁移更新；TaskRegistry 在执行协程时通过 contextvars 传递当前任务编号，write_game_log 自动写入；日志接口支持按 task_id 过滤；生产环境 init_db 只做检查与迁移状态校验。

**Tech Stack:** FastAPI + SQLAlchemy Async + Alembic；React/Ant Design；unittest。

---

## Task 1：后端任务-日志关联（schema + contextvar + 查询接口）

**Files:**
- Modify: `/workspace/backend/app/models/schemas.py`
- Create: `/workspace/backend/app/services/game/task_context.py`
- Modify: `/workspace/backend/app/services/game/task_registry.py`
- Modify: `/workspace/backend/app/services/game/logging.py`
- Modify: `/workspace/backend/app/api/routes/logs.py`
- Create: `/workspace/backend/alembic/versions/20260430_0002_log_task_id.py`
- Test: `/workspace/backend/tests/test_log_task_id_link.py` (new)

- [ ] **Step 1: 新增 contextvar**

Create `backend/app/services/game/task_context.py`：

```python
from contextvars import ContextVar
from typing import Optional

current_task_id: ContextVar[Optional[str]] = ContextVar("current_task_id", default=None)
```

- [ ] **Step 2: write_game_log 自动带 task_id**

在 `write_game_log()` 创建 `SystemLog` 时读取 `current_task_id.get()` 并写入 `task_id` 字段（无则为 None）。

- [ ] **Step 3: TaskRegistry 在任务协程执行时注入 task_id**

在 TaskRegistry 的 `_runner` 内部：
- 执行前 `token = current_task_id.set(meta.task_id)`
- finally 里 `current_task_id.reset(token)`

- [ ] **Step 4: SystemLog 增加字段**

在 `SystemLog` 增加：
- `task_id = Column(String(36), nullable=True)`
- 新增索引 `idx_log_task_id`

- [ ] **Step 5: Alembic 迁移（新增列）**

Create `backend/alembic/versions/20260430_0002_log_task_id.py`：

```python
from alembic import op
import sqlalchemy as sa

revision = "20260430_0002"
down_revision = "20260430_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("system_logs") as batch:
        batch.add_column(sa.Column("task_id", sa.String(length=36), nullable=True))
        batch.create_index("idx_log_task_id", ["task_id"])


def downgrade() -> None:
    with op.batch_alter_table("system_logs") as batch:
        batch.drop_index("idx_log_task_id")
        batch.drop_column("task_id")
```

- [ ] **Step 6: logs API 支持 task_id 过滤**

在 `GET /api/logs` 增加 query 参数 `task_id`，若传入则 `where(SystemLog.task_id == task_id)`。

- [ ] **Step 7: 新增单测**

Create `backend/tests/test_log_task_id_link.py`：

```python
import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class LogTaskIdLinkTest(unittest.TestCase):
    def test_write_game_log_auto_sets_task_id(self):
        async def _run():
            from sqlalchemy import select
            from app.core.database import async_session
            from app.models.schemas import SystemLog
            from app.services.game.task_registry import registry
            from app.services.game.logging import write_game_log

            async def job():
                async with async_session() as s:
                    await write_game_log(
                        s,
                        boot_number=1,
                        game_number=None,
                        event_code="LOG-TEST-001",
                        event_type="测试",
                        event_result="成功",
                        description="task log link",
                        category="测试",
                        priority="P3",
                        source_module="Test",
                    )
                    await s.commit()

            meta = registry.create("test", job(), boot_number=1, dedupe_key="test:log")
            await meta.task

            async with async_session() as s:
                row = (await s.execute(
                    select(SystemLog).where(SystemLog.event_code == "LOG-TEST-001").order_by(SystemLog.id.desc())
                )).scalars().first()
                return meta.task_id, row.task_id if row else None

        task_id, log_task_id = asyncio.run(_run())
        self.assertEqual(task_id, log_task_id)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 8: 验证**

Run: `python -m unittest backend/tests/test_log_task_id_link.py -v`  
Expected: PASS

---

## Task 2：前端联动（任务页跳日志页 + 日志页 task_id 筛选）

**Files:**
- Modify: `/workspace/frontend/src/services/api.ts`
- Modify: `/workspace/frontend/src/hooks/useQueries.ts` (或相关 logs query hook 文件)
- Modify: `/workspace/frontend/src/pages/LogsPage.tsx`
- Modify: `/workspace/frontend/src/pages/AdminPage.tsx`

- [ ] **Step 1: API 增加 logs task_id 参数（透传）**

在 `getLogs`/`useLogsQuery` 的请求参数里加入 `task_id`（可选）。

- [ ] **Step 2: LogsPage 支持从 URL 读取 task_id 并作为筛选条件**

从 `location.search` 解析 `task_id`，初始化筛选状态并触发查询。

- [ ] **Step 3: AdminPage 任务表新增“查看日志”**

“查看日志”跳转到日志页：
- `/dashboard/main/logs?task_id=<task_id>`

- [ ] **Step 4: 构建验证**

Run: `npm run lint`  
Expected: PASS

Run: `npm run build`  
Expected: PASS

---

## Task 3：迁移严格模式（生产禁用 create_all/auto-migrate）

**Files:**
- Modify: `/workspace/backend/app/core/database.py`
- Test: `/workspace/backend/tests/test_migration_strict_mode.py` (new)

- [ ] **Step 1: 修改 init_db 行为**

当 `settings.ENVIRONMENT == "production"`：
- 不执行 `Base.metadata.create_all`
- 不执行 SQLite `sync_columns`
- 改为检查：
  - `alembic_version` 表存在
  - `system_logs` / `background_tasks` 表存在
- 若不满足：`raise RuntimeError("生产环境数据库未完成迁移，请先执行 alembic upgrade head")`

当非 production：保留原行为。

- [ ] **Step 2: 单测**

Create `backend/tests/test_migration_strict_mode.py`：
- 设置 `ENVIRONMENT=production`
- 临时使用一个空 sqlite db（不同路径）
- 调用 `init_db()` 应抛 `RuntimeError`

- [ ] **Step 3: 全量验证**

Run: `python -m unittest discover -s backend/tests -p 'test_*.py' -v`  
Expected: PASS

Run: `DATABASE_URL=sqlite+aiosqlite:///./data/alembic_strict_test.db alembic -c alembic.ini upgrade head`  
Expected: PASS

