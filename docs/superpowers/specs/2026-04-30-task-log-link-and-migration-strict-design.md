# 继续加固：任务-日志关联 + 迁移严格模式 设计稿

日期：2026-04-30  
范围：后端（TaskRegistry / SystemLog / init_db / Alembic）、前端（任务页跳日志页）、部署文档

## 目标

1. 每条后台任务（BackgroundTask）可以追溯到其产生的系统日志（SystemLog），用于线上排障与审计。
2. 生产环境禁止“自动建表/自动加字段”，必须通过 Alembic 迁移完成数据库结构升级，否则拒绝启动（迁移严格模式）。

## 任务-日志关联设计

### 关联方式（推荐）

- 在 `system_logs` 增加可空字段 `task_id`（指向 `background_tasks.task_id`）。
- 在 TaskRegistry 运行协程时，用 `contextvars` 写入当前 `task_id`。
- `write_game_log()` 自动从 contextvar 读取 `task_id` 并写入 SystemLog。

优点：
- 不需要在每个业务调用点手动传 `task_id`，侵入性最小。
- 只要日志发生在后台任务协程里，就自动具备关联信息。

### 前端呈现（默认方案）

- 管理员后台任务列表每行新增“查看日志”，跳转到日志页并自动按 `task_id` 筛选。
- 日志页新增筛选项：任务编号（task_id），支持 URL query 预填（例如 `?task_id=...`）。

## 迁移严格模式设计

### 规则

当 `ENVIRONMENT=production` 时：
- 后端启动阶段不得执行 `Base.metadata.create_all` 与 SQLite 的 “Auto-Migrate missing columns”。
- 启动阶段仅做数据库可用性检查与迁移状态检查：
  - 必须存在 `alembic_version` 表（说明已运行过 Alembic）
  - 必须存在关键业务表（至少 `system_logs`、`background_tasks`）
- 不满足则抛出 `RuntimeError(中文原因)` 并拒绝启动，提示运维先执行 `alembic upgrade head`。

当 `ENVIRONMENT != production` 时：
- 允许使用现有 `init_db()` 的 `create_all`（便于本地与测试快速启动）。

## 验收

1. 后台任务执行时写入的日志记录带有 `task_id`；通过 `GET /api/logs?task_id=...` 能筛出对应日志。
2. 管理员任务列表可一键跳转日志页并自动筛选。
3. `ENVIRONMENT=production` 且未运行迁移时，后端启动会拒绝并给出中文提示；运行 `alembic upgrade head` 后可正常启动。

