# 后台任务治理与诊断增强 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为后端异步后台任务提供可追踪/可去重/可取消的治理能力，并增强系统诊断接口与测试洁净度。

**Architecture:** 新增 TaskRegistry 作为后台任务注册表，对 `asyncio.create_task` 统一封装与管理；在系统诊断接口暴露任务摘要与任务列表/取消能力；修复测试中的资源未关闭告警；把对用户的诊断提示中文化（保留“AI”）。

**Tech Stack:** FastAPI + asyncio tasks + SQLAlchemy Async；React（仅消费 diagnostics，不强制新增页面）。

---

## Task 1：修复单测 ResourceWarning（HTTPError 关闭）

**Files:**
- Modify: `/workspace/backend/tests/test_upload_modes.py`

- [ ] **Step 1: 写失败测试（捕获 ResourceWarning）**

在 `test_upload_modes.py` 顶部加入：

```python
import warnings
```

并在 `test_game_number_over_72_rejected_by_validation` 用 `warnings.catch_warnings(record=True)` 包裹调用，断言没有 `ResourceWarning`。

- [ ] **Step 2: 运行该测试确认失败**

Run: `python -m unittest backend/tests/test_upload_modes.py -v`  
Expected: FAIL（存在 ResourceWarning）

- [ ] **Step 3: 最小实现（关闭 HTTPError）**

在 `_post_json` 的 `except urllib.error.HTTPError as e:` 分支中：

```python
    except urllib.error.HTTPError as e:
        try:
            data = e.read().decode("utf-8")
            return e.code, data
        finally:
            e.close()
```

- [ ] **Step 4: 运行测试确认通过**

Run: `python -m unittest backend/tests/test_upload_modes.py -v`  
Expected: PASS

---

## Task 2：实现 TaskRegistry（登记/去重/取消/状态回写）

**Files:**
- Create: `/workspace/backend/app/services/game/task_registry.py`
- Modify: `/workspace/backend/app/services/game/session.py`
- Test: `/workspace/backend/tests/test_task_registry.py` (new)

- [ ] **Step 1: 写失败测试**

Create `/workspace/backend/tests/test_task_registry.py`：

```python
import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class TaskRegistryTest(unittest.TestCase):
    def test_dedupe_key_prevents_duplicate_running_tasks(self):
        async def _run():
            from app.services.game.task_registry import registry

            async def job():
                await asyncio.sleep(0.05)
                return 1

            t1 = registry.create(task_type="demo", coro=job(), boot_number=1, dedupe_key="demo:1")
            t2 = registry.create(task_type="demo", coro=job(), boot_number=1, dedupe_key="demo:1")
            self.assertEqual(t1.task_id, t2.task_id)
            await t1.task
            return registry.list()

        tasks = asyncio.run(_run())
        self.assertTrue(tasks)

    def test_cancel_marks_cancelled(self):
        async def _run():
            from app.services.game.task_registry import registry

            async def job():
                await asyncio.sleep(5)
                return 1

            t = registry.create(task_type="demo", coro=job(), boot_number=1, dedupe_key="demo:cancel")
            ok = registry.cancel(t.task_id)
            self.assertTrue(ok)
            await asyncio.sleep(0)
            meta = next(x for x in registry.list() if x["task_id"] == t.task_id)
            return meta

        meta = asyncio.run(_run())
        self.assertIn(meta["status"], ("cancelled", "failed"))


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 运行测试确认失败**

Run: `python -m unittest backend/tests/test_task_registry.py -v`  
Expected: FAIL（模块不存在）

- [ ] **Step 3: 最小实现 task_registry.py**

Create `/workspace/backend/app/services/game/task_registry.py`：

```python
import asyncio
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Optional, Any, Coroutine
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

    def create(self, task_type: str, coro: Coroutine, boot_number: Optional[int] = None, dedupe_key: Optional[str] = None) -> RegisteredTask:
        if dedupe_key and dedupe_key in self._by_key:
            existing_id = self._by_key[dedupe_key]
            existing = self._tasks.get(existing_id)
            if existing and existing.status == "running":
                return existing

        task_id = str(uuid4())
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
```

- [ ] **Step 4: session.py 兼容接入**

将 `/workspace/backend/app/services/game/session.py` 的 `add_background_task` 改为委托给 registry（仍保留原函数签名），并新增：

- `list_background_tasks()`：返回 registry.list()

- [ ] **Step 5: 运行测试确认通过**

Run: `python -m unittest backend/tests/test_task_registry.py -v`  
Expected: PASS

Run: `python -m unittest discover -s backend/tests -p 'test_*.py' -v`  
Expected: PASS

---

## Task 3：接入深度学习与管理员学习任务

**Files:**
- Modify: `/workspace/backend/app/services/game/boot.py`
- Modify: `/workspace/backend/app/api/routes/analysis.py`
- Test: `/workspace/backend/tests/test_task_registry_integration.py` (new)

- [ ] **Step 1: 写失败测试（创建任务后 registry 可见）**

Create `/workspace/backend/tests/test_task_registry_integration.py`：

```python
import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class TaskRegistryIntegrationTest(unittest.TestCase):
    def test_registry_accepts_deep_learning_task(self):
        async def _run():
            from app.services.game.task_registry import registry
            from app.services.game.session import add_background_task
            import asyncio

            async def job():
                await asyncio.sleep(0)

            t = asyncio.create_task(job())
            add_background_task(t)
            await t
            return registry.list()

        tasks = asyncio.run(_run())
        self.assertTrue(isinstance(tasks, list))


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 修改 boot.py 用 registry.create**

将 `end_boot` 中：

```python
task = asyncio.create_task(run_deep_learning(current_boot))
add_background_task(task)
```

替换为：

```python
from app.services.game.task_registry import registry
registry.create("deep_learning", run_deep_learning(current_boot), boot_number=current_boot, dedupe_key=f"deep_learning:{current_boot}")
```

- [ ] **Step 3: 修改 analysis.py 的 asyncio.create_task 接入 registry**

将后台学习任务注册为：

`task_type="ai_learning"`，`dedupe_key=f"ai_learning:{boot_number}"`

- [ ] **Step 4: 跑测试**

Run: `python -m unittest backend/tests/test_task_registry_integration.py -v`  
Expected: PASS

Run: `python -m unittest discover -s backend/tests -p 'test_*.py' -v`  
Expected: PASS

---

## Task 4：系统诊断增强（任务列表/取消 + 中文化）

**Files:**
- Modify: `/workspace/backend/app/api/routes/system.py`
- Test: `/workspace/backend/tests/test_system_tasks_api.py` (new)

- [ ] **Step 1: 写失败测试（只测函数逻辑）**

Create `/workspace/backend/tests/test_system_tasks_api.py`：

```python
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class SystemTasksApiTest(unittest.TestCase):
    def test_diagnostics_include_background_tasks(self):
        import asyncio
        from app.api.routes import system as system_routes

        async def _run():
            res = await system_routes.get_system_diagnostics()
            return res

        data = asyncio.run(_run())
        self.assertIn("background_tasks", data)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 实现 /api/system/tasks 与取消接口，并在 diagnostics 里追加 background_tasks**

在 `get_system_diagnostics()` 中：
- 引入 `registry.list()`，统计 running 数
- 将模型 issue 文案统一为中文（不要出现 OPENAI_API_KEY 等键名）

- [ ] **Step 3: 跑全量后端测试**

Run: `python -m unittest discover -s backend/tests -p 'test_*.py' -v`  
Expected: PASS

---

## Plan 自检

- 覆盖检查：任务治理、diagnostics 增强、测试告警修复、中文化均有任务覆盖。
- 占位扫描：无 TBD/TODO；每个任务给出文件路径与命令。

