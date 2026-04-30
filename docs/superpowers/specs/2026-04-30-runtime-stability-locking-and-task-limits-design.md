# 运行稳定治理：内存锁一致性 + 任务类型白名单与限流 设计稿

日期：2026-04-30

## 目标

1. 内存态一致性：所有对全局 `ManualSession` 的写入必须在 `get_session_lock()` 保护下完成，避免并发写导致撕裂状态。
2. DB 状态一致性：所有对 `SystemState` 的更新统一通过 `get_or_create_state(... with_for_update)`，避免并发下更新到错误行或出现覆盖。
3. 任务稳定性：后台任务 `task_type` 增加白名单与默认并发上限，防止“新类型绕过限流”；并把 `ai_learning` 纳入 `start_background_task` 与 semaphore=1。
4. 可回归：新增单测覆盖上述规则，防止未来回归。

## 范围

### A) 内存 Session 写入统一加锁

覆盖点（代表性高风险点）：
- 启动恢复与手工修复：`recover_on_startup / repair_stuck_state`
- 启动同步：`sync_balance_from_db`
- 系统配置与管理入口：`/api/system/prediction-mode`（更新预测模式）

策略：
- 所有写 `mem = get_session(); mem.xxx = ...` 改为：
  - `lock = get_session_lock(); async with lock: mem = get_session(); ...`

### B) SystemState 更新统一走 get_or_create_state

覆盖点：
- `/api/system/prediction-mode`：DB 更新改用 `get_or_create_state(session)`
- 其余后续新增路由：默认也必须遵循该模式（通过测试/代码审查约束）。

### C) start_background_task 收口（白名单 + 默认限流）

新增：
- `ALLOWED_TASK_TYPES = {...}` 白名单
- `_task_semaphores` 增加：
  - `ai_learning: Semaphore(1)`
  - `default: Semaphore(settings.DEFAULT_TASK_CONCURRENCY)`（例如 5）
- 行为：
  - task_type 不在白名单：直接抛出 `ValueError`
  - 若 task_type 未配置专属 semaphore，则使用 default semaphore

并将 `registry.create("ai_learning", ...)` 改为 `start_background_task("ai_learning", ...)`，避免绕过限流与诊断语义不一致。

## 验收

1. 回归测试覆盖：
   - 未知 task_type 被拒绝
   - ai_learning 同类型并发被串行化（Semaphore=1）
   - prediction_mode 更新时，内存与 DB 状态一致
2. 后端全量 unittest 通过，前端不受影响。

