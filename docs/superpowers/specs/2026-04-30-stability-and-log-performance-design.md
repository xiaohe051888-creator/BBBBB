# 稳 + 快：流程稳定性加固与日志页性能优化 设计稿

日期：2026-04-30

## 目标

### 稳（后端优先）

1. 防止后台任务并发堆积导致状态机被覆盖或卡死。
2. 进程重启后自动“恢复到安全态”：把 DB 中遗留的 running 任务标记为已取消，并把系统状态从“分析中/深度学习中”等中间态回落到可继续操作的状态。
3. 用回归测试把上述行为锁死，防止未来回归。

### 快（日志页/任务页）

1. 日志页不再固定拉取 200 条再在前端筛选；改为服务端分页 + 服务端筛选（category / priority / task_id），减少渲染压力与内存占用。
2. 前端查询缓存键包含分页与筛选条件，避免错用缓存造成“看起来没刷新”的体验问题。

## 方案

### 1) 后台任务并发上限（Semaphore）

- 在 `start_background_task` 内部引入“任务类型→并发上限”：
  - `analysis`：1
  - `deep_learning`：1
  - `micro_learning`：1
  - 其他类型：不限制（或默认 5）
- 通过包装 coroutine：执行前 `await semaphore.acquire()`，执行后 `finally: semaphore.release()`，保证异常/取消也释放。
- 任务类型由调用点明确传入（例如游戏路由触发分析应传 `analysis` 而不是笼统的 `background`）。

### 2) 重启恢复（startup recovery）

应用启动（lifespan）完成 init_db 后执行：

- 将 `background_tasks` 表中 `status="running"` 的记录统一改为：
  - `status="cancelled"`
  - `message="服务重启自动取消"`
  - `finished_at=now()`
- 将 `system_state`（SystemState）中的中间态回落到安全态：
  - `status="分析中"` → `status="等待开奖"`
  - `status="深度学习中"` → `status="等待新靴"`
- 同时写入一条 SystemLog（便于排障与审计），event_code 固定：
  - `LOG-RECOVER-001`（任务恢复）
  - `LOG-RECOVER-002`（状态回落）

### 3) 日志接口与前端改造（服务端分页/筛选）

- 后端 `/logs` 支持 priority 过滤（已有参数）与 task_id（已实现），并继续支持分页。
- 前端 LogsPage：
  - `useLogsQuery` 查询 key 纳入 `(category, taskId, priority, page, pageSize)`。
  - 日志页筛选与分页走服务端；前端只做极轻量的“关键字搜索（说明/局号）”或将搜索也下沉服务端（后续可选）。

## 验收

1. 触发并发分析/学习时，不会启动多个同类任务并发执行（同类型排队）。
2. 重启后系统状态不会长期停留在“分析中/深度学习中”；后台任务表不会残留永远 running 的记录。
3. 日志页在日志量较大时仍能顺滑分页与筛选，且筛选命中结果可复现。

