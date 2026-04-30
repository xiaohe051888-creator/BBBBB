# 稳 + 快：流程稳定性加固与日志页性能优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 提升核心链路稳定性（并发上限 + 重启恢复）并优化日志页性能（服务端分页/筛选），确保可测试、可回归。

**Architecture:** `start_background_task` 内通过 semaphore 限制同类型任务并发；lifespan 启动时清理遗留 running 任务并回落 system 状态；前端日志页按筛选条件与分页调用后端并缓存。

**Tech Stack:** FastAPI + SQLAlchemy + asyncio；React Query + Ant Design；unittest。

---

## Task 1：后台任务并发上限（Semaphore）

**Files:**
- Modify: `/workspace/backend/app/services/game/session.py`
- Modify: `/workspace/backend/app/api/routes/game.py`
- Modify: `/workspace/backend/app/services/game/betting.py`
- Modify: `/workspace/backend/app/services/game/boot.py`
- Test: `/workspace/backend/tests/test_task_concurrency_limits.py`

- [ ] **Step 1: 在 session.py 增加任务类型 semaphore 映射**

在 `session.py` 增加全局字典：
- `analysis/deep_learning/micro_learning = asyncio.Semaphore(1)`

在 `start_background_task` 中包装 coroutine：
- `await sem.acquire()` → `try: await coro` → `finally: sem.release()`

- [ ] **Step 2: 调整调用点传入更具体的 task_type**

将分析触发的 `start_background_task("background", ...)` 改为：
- `start_background_task("analysis", ...)`

微学习改为：
- `start_background_task("micro_learning", ...)`

深度学习已经是 `registry.create("deep_learning", ...)`，保持一致或改用 `start_background_task("deep_learning", ...)`（二选一，保持可追溯）。

- [ ] **Step 3: 单测验证并发限制**

Create `test_task_concurrency_limits.py`：
- 启动两个 `start_background_task("analysis", ...)`，第一个阻塞，确保第二个不会在第一个释放前进入临界区（用 `asyncio.Event` + 共享计数验证最大并发为 1）。

---

## Task 2：重启恢复（startup recovery）

**Files:**
- Modify: `/workspace/backend/app/api/main.py`
- Create: `/workspace/backend/app/services/game/recovery.py`
- Test: `/workspace/backend/tests/test_startup_recovery.py`

- [ ] **Step 1: 新增 recovery 模块**

Create `recovery.py`：
- `async def recover_on_startup(db: AsyncSession) -> None`
  - 将 BackgroundTask.status == running → cancelled + finished_at=now
  - SystemState.status 回落（分析中→等待开奖；深度学习中→等待新靴）
  - 写 SystemLog（LOG-RECOVER-001/002）

- [ ] **Step 2: 在 lifespan 启动时调用 recover_on_startup**

在 `main.py` 的 lifespan 中，在 init_db 与状态同步后调用：
- `await recover_on_startup(session)`

- [ ] **Step 3: 单测覆盖**

Create `test_startup_recovery.py`：
- init_db
- 手工插入 running 的 BackgroundTask 与 SystemState.status="分析中"
- 调用 `recover_on_startup`
- 断言：BackgroundTask.status 已变 cancelled，SystemState.status 已变等待开奖，且写入了 SystemLog。

---

## Task 3：日志页服务端分页/筛选

**Files:**
- Modify: `/workspace/frontend/src/lib/queryClient.ts`
- Modify: `/workspace/frontend/src/hooks/useQueries.ts`
- Modify: `/workspace/frontend/src/pages/LogsPage.tsx`

- [ ] **Step 1: queryKeys.logs 纳入分页/筛选维度**

`queryKeys.logs(category, taskId, priority, page, pageSize)`（或等价结构）。

- [ ] **Step 2: useLogsQuery 透传 priority/task_id/page/page_size**

更新 `api.getLogs` 调用参数，返回结构不变。

- [ ] **Step 3: LogsPage 改为服务端分页**

删除/减少 “拉 200 条” 的固定行为：
- 查询参数使用 `page/pageSize/filterCategory/filterPriority/filterTaskId`
- 表格 `pagination.total` 使用后端返回的 total

---

## Task 4：全量验证

- [ ] **Step 1: 后端全量单测**

Run:

```bash
python -m unittest discover -s backend/tests -p 'test_*.py' -v
```

- [ ] **Step 2: 前端 lint/build**

Run:

```bash
npm run lint
npm run build
```

