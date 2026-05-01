# 测试退出清理（消除 aiosqlite ResourceWarning）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 加强测试/进程退出时的数据库引擎清理，确保不会因为事件循环状态导致 `engine.dispose()` 未执行，从而出现 `aiosqlite ResourceWarning`。

**Architecture:** 在 `app/core/database.py` 的 atexit 清理逻辑中，如果 `asyncio.run()` 因事件循环状态失败，则创建一个新事件循环执行 `close_db()`，保证最终一定 dispose 引擎。

**Tech Stack:** Python asyncio + SQLAlchemy async engine。

---

### Task 1: 强化 atexit 清理逻辑

**Files:**
- Modify: [database.py](file:///workspace/backend/app/core/database.py#L145-L165)

- [ ] **Step 1: 修改 _dispose_on_exit**

目标行为：
- 优先 `asyncio.run(close_db())`
- 若抛 `RuntimeError`（例如 “event loop is closed” 或 “asyncio.run cannot be called…”），则：
  - `loop = asyncio.new_event_loop()`
  - `asyncio.set_event_loop(loop)`
  - `loop.run_until_complete(close_db())`
  - `loop.close()`
  - `asyncio.set_event_loop(None)`

- [ ] **Step 2: 跑全量后端测试确认无失败**

```bash
mkdir -p /workspace/data
python -m unittest discover -s backend/tests -p 'test_*.py' -v
```

Expected: PASS

