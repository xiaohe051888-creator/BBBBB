# CI 防回归 + spawn_task 可观测性 + 日志缓存优化 + antd 包体治理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让后台任务规范可持续（CI 防回归）、异常可追踪（日志+SystemLog）、前端推送更省（只更新已存在缓存）、构建告警更干净（调整阈值并增量按需化）。

**Architecture:** 后端用 unittest 扫描源码防止裸 create_task；spawn_task 增加 name 与异常上报；前端 useAddLogOptimistically 只更新已存在的 queryKey；Vite 调高 chunkSizeWarningLimit，并对入口与常驻模块增量改用更细粒度 antd 导入。

**Tech Stack:** Python unittest；React Query；Vite；Ant Design。

---

## Task 1：后端 CI 防回归（unittest 扫描 create_task）

**Files:**
- Create: `/workspace/backend/tests/test_no_naked_create_task.py`

- [ ] **Step 1: 写单测（先失败后修）**

Create:

```python
import os
import re
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class NoNakedCreateTaskTest(unittest.TestCase):
    def test_no_asyncio_create_task_in_app(self):
        root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app"))
        whitelist = {os.path.join(root, "core", "async_utils.py")}
        patterns = [
            re.compile(r"\\basyncio\\.create_task\\("),
            re.compile(r"\\.create_task\\("),
        ]

        violations = []
        for dirpath, _, filenames in os.walk(root):
            for fn in filenames:
                if not fn.endswith(".py"):
                    continue
                path = os.path.join(dirpath, fn)
                if path in whitelist:
                    continue
                with open(path, "r", encoding="utf-8") as f:
                    text = f.read()
                for p in patterns:
                    if p.search(text):
                        violations.append(path)
                        break

        if violations:
            msg = "\\n".join(violations)
            raise AssertionError(
                "检测到裸 create_task 调用，请改用 spawn_task(...) 或 start_background_task(...):\\n" + msg
            )


if __name__ == \"__main__\":
    unittest.main()
```

- [ ] **Step 2: 运行全量单测验证**

Run:

```bash
python -m unittest discover -s backend/tests -p 'test_*.py' -v
```

Expected: PASS

---

## Task 2：spawn_task 可观测性（logger + SystemLog）

**Files:**
- Modify: `/workspace/backend/app/core/async_utils.py`

- [ ] **Step 1: 扩展 spawn_task 签名与命名**

新增参数 `name: str | None = None`，若有 name：
- 优先 `asyncio.create_task(coro, name=name)`（若不支持则 `task.set_name(name)`）

- [ ] **Step 2: 异常同时写 logger 与 SystemLog**

done 回调中：
- `task.exception()` 若存在：
  - `logging.getLogger("uvicorn.error").error(...)` with `exc_info=True`
  - `spawn_task(_report_exception(...), name="spawn_task_report", report_to_system_log=False)` 写 SystemLog

写 SystemLog 的 coroutine：
- 使用 `app.core.database.async_session`
- 使用 `app.services.game.logging.write_game_log`

---

## Task 3：前端日志推送缓存写入降开销

**Files:**
- Modify: `/workspace/frontend/src/hooks/useQueries.ts`

- [ ] **Step 1: 仅更新已存在 key**

保留“始终更新全量 key”，其他 key 在 `queryClient.getQueryData(key)` 存在时才 `setQueryData`。

- [ ] **Step 2: 前端 lint/build**

Run:

```bash
npm run lint
npm run build
```

Expected: PASS

---

## Task 4：antd 告警阈值 + 入口/常驻模块增量按需化

**Files:**
- Modify: `/workspace/frontend/vite.config.ts`
- Modify: `/workspace/frontend/src/App.tsx`
- Modify: `/workspace/frontend/src/pages/DashboardPage.tsx`（及其常驻子组件视实际引用范围）

- [ ] **Step 1: 调高 chunkSizeWarningLimit**

在 `build` 配置里加入：

```ts
build: { chunkSizeWarningLimit: 1500 }
```

- [ ] **Step 2: 入口/常驻模块改为更细粒度导入**

优先对 `App.tsx` 与 Dashboard 常驻模块，将 `from 'antd'` 的导入拆分为更细粒度导入（不引入新依赖），并确保类型/样式无回归。

- [ ] **Step 3: 再次 lint/build**

Run:

```bash
npm run lint
npm run build
```

Expected: PASS

