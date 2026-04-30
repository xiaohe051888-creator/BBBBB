# 运行稳定治理：内存锁一致性 + 任务类型白名单与限流 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 统一加固内存 Session 写入锁、SystemState 行锁更新，并对后台任务类型做白名单与默认限流，提升运行稳定性与可回归性。

**Architecture:** 写内存必须 `async with get_session_lock()`；DB state 更新统一 `get_or_create_state(with_for_update)`；任务类型白名单 + default semaphore + ai_learning 纳入 start_background_task。

**Tech Stack:** Python unittest + asyncio.run；SQLAlchemy AsyncSession；FastAPI。

---

## Task 1：内存 Session 写入加锁

**Files:**
- Modify: `/workspace/backend/app/services/game/recovery.py`
- Modify: `/workspace/backend/app/services/game/state.py`
- Modify: `/workspace/backend/app/api/routes/system.py`

- [ ] **Step 1: recovery.py 写 mem.status 加锁**
- [ ] **Step 2: state.py sync_balance_from_db 写 mem.* 加锁**
- [ ] **Step 3: system.py update_prediction_mode 写 mem.prediction_mode 加锁，并 DB 更新改用 get_or_create_state**

---

## Task 2：start_background_task 白名单 + 默认并发上限 + ai_learning 纳入

**Files:**
- Modify: `/workspace/backend/app/services/game/session.py`
- Modify: `/workspace/backend/app/api/routes/analysis.py`
- Test: `/workspace/backend/tests/test_background_task_type_limits.py`

- [ ] **Step 1: session.py 增加 task_type 白名单与 default semaphore**
- [ ] **Step 2: session.py 将 ai_learning 纳入 sem=1**
- [ ] **Step 3: analysis.py 将 ai_learning 任务创建改为 start_background_task("ai_learning", ...)**
- [ ] **Step 4: 单测覆盖**
  - 未知 task_type 抛 ValueError
  - 同时触发两个 ai_learning（不同 dedupe_key），确保并发为 1（串行）

---

## Task 3：全量验证

- [ ] **Step 1: 后端全量 unittest**

Run:

```bash
python -m unittest discover -s backend/tests -p 'test_*.py' -v
```

