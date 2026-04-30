# 后台任务统一规范 + 前端路由级拆包 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 后端统一后台任务创建规范（减少裸 create_task、保证强引用与可追溯），前端路由页面按需加载以降低首屏 bundle 压力。

**Architecture:** 后端新增 `spawn_task(coro)` 作为 fire-and-forget 统一入口，并让业务后台任务统一走 `start_background_task(task_type, coro, ...)`；前端 `App.tsx` 使用 `React.lazy + Suspense` 对页面组件做路由级动态 import。

**Tech Stack:** FastAPI + asyncio + SQLAlchemy + Alembic；React + react-router + Ant Design；unittest；eslint/vite。

---

## Task 1：后端 async task 规范化（spawn_task + 消灭裸 create_task）

**Files:**
- Create: `/workspace/backend/app/core/async_utils.py`
- Modify: `/workspace/backend/app/api/routes/websocket.py`
- Modify: `/workspace/backend/app/services/game/boot.py`
- Modify: `/workspace/backend/app/services/three_model_service.py`
- Modify: `/workspace/backend/app/services/game/task_registry.py`
- Modify: `/workspace/README.md`

- [ ] **Step 1: 新增 spawn_task**

Create `backend/app/core/async_utils.py`：

```python
import asyncio
from typing import Awaitable, Coroutine, Set, Any

_tasks: Set[asyncio.Task] = set()


def spawn_task(coro: Awaitable[Any] | Coroutine[Any, Any, Any]) -> asyncio.Task:
    task = asyncio.create_task(coro)
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)
    return task
```

- [ ] **Step 2: websocket 断开清理使用 spawn_task**

Replace:

```python
asyncio.create_task(_remove_client(client))
```

With:

```python
from app.core.async_utils import spawn_task
spawn_task(_remove_client(client))
```

- [ ] **Step 3: boot.py 的 fire-and-forget 使用 start_background_task**

Replace:

```python
task2 = asyncio.create_task(_trigger_next_boot_analysis())
add_background_task(task2)
```

With:

```python
from app.services.game.session import start_background_task
start_background_task("background", _trigger_next_boot_analysis())
```

- [ ] **Step 4: three_model_service 并行执行改为 gather（不显式 create_task）**

Replace `banker_task/player_task = asyncio.create_task(...)` with:

```python
banker_result, player_result = await asyncio.wait_for(
    asyncio.gather(
        self._banker_model(game_history, road_data, mistake_context),
        self._player_model(game_history, road_data, mistake_context),
    ),
    timeout=self.global_timeout,
)
```

Timeout 时直接 raise，依赖 `wait_for` 自动取消。

- [ ] **Step 5: TaskRegistry 内部创建 runner 使用 spawn_task**

Replace `asyncio.create_task(_runner())` with `spawn_task(_runner())`，并将同文件内“调度异步落库”的地方也改为 `spawn_task(...)`（避免裸 create_task 出现）。

- [ ] **Step 6: README 增加后台任务规范**

Add a short section:
- 业务后台任务：用 `start_background_task(task_type, coro, boot_number?, dedupe_key?)`
- 非业务 fire-and-forget：用 `spawn_task(coro)`

---

## Task 2：前端路由级拆包（React.lazy + Suspense）

**Files:**
- Modify: `/workspace/frontend/src/App.tsx`

- [ ] **Step 1: 页面改为 React.lazy 动态 import**

Replace direct imports:

```ts
import DashboardPage from './pages/DashboardPage';
...
```

With:

```ts
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
...
```

- [ ] **Step 2: Suspense 包裹路由并提供 Spin fallback**

Add:

```ts
import { Spin } from 'antd';
import { Suspense } from 'react';
```

Wrap `<Routes>` with:

```tsx
<Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spin /></div>}>
  <Routes>...</Routes>
</Suspense>
```

---

## Task 3：验证

- [ ] **Step 1: 后端全量单测**

Run:

```bash
python -m unittest discover -s backend/tests -p 'test_*.py' -v
```

Expected: PASS

- [ ] **Step 2: 前端 lint/build**

Run:

```bash
npm run lint
npm run build
```

Expected: PASS

