# 继续加固：任务取消一致性 + 生产安全硬校验 设计稿

日期：2026-04-30  
范围：后端（深度学习/学习任务、TaskRegistry、启动校验）、部署（Render/docker compose）、测试

## 背景问题

1. 任务虽支持取消，但“深度学习”被取消时未显式处理 `CancelledError`，可能导致：
   - 内存会话仍停留在 `深度学习中`
   - 数据库 SystemState 仍为 `深度学习中`
   - 前端被卡死（无法继续开新靴/无法正确提示）
2. 生产环境存在默认/危险配置风险：
   - `JWT_SECRET_KEY` 可能是占位或未设置（重启即变，登录态不稳定）
   - `ADMIN_DEFAULT_PASSWORD` 可能仍是默认值
   - `CORS_ORIGINS` 若为 `*`，生产暴露面过大

## 目标

1. 任务取消后系统状态可恢复到稳定可继续运行的状态（不“卡死”）。
2. 取消行为可观测：写入系统日志并推送事件，前端能提示“已取消”。
3. 生产环境启动时对危险配置做硬校验：发现风险直接拒绝启动，并给出明确中文错误原因。

## 方案与选择

### 方案 A：在取消 API 里做“强制回滚”
- 优点：集中在一个入口
- 缺点：任务也可能因其他原因被取消（超时/进程停止），无法覆盖；并且逻辑与具体任务强耦合

### 方案 B：每个可取消任务自己处理 CancelledError（推荐）
- 优点：无论从哪里取消，任务协程都能完成“收尾与回滚”
- 缺点：需要在关键任务中补齐取消处理分支

选择：方案 B。

## 详细设计

### 1）深度学习取消一致性（boot.run_deep_learning）

新增 `except asyncio.CancelledError` 分支：

- 内存会话：
  - `sess.deep_learning_status.status = "已取消"`
  - `sess.deep_learning_status.progress = 0`
  - `sess.status = "等待新靴"`（取消视为管理员主动跳过学习，允许继续开新靴）
- 数据库 SystemState：
  - `state.status = "等待新靴"`
- 可观测：
  - 写入系统日志（例如 `LOG-BOOT-003`，事件类型：深度学习，结果：取消）
  - WebSocket 广播 `deep_learning_cancelled`
- 行为要求：清理完成后重新抛出 `CancelledError`，确保 TaskRegistry 记录为 cancelled

### 2）管理员学习任务取消可观测（analysis.run_learning_task）

在后台学习任务 wrapper 中新增 `except asyncio.CancelledError`：

- 写入系统日志（例如 `LOG-AI-002`，事件类型：AI学习，结果：取消）
- 重新抛出 `CancelledError`（使 TaskRegistry 记录为 cancelled）

说明：`AILearningService.start_learning` 自身有 `finally: release_lock()`，因此锁释放不依赖该分支，但需要补齐“取消日志”。

### 3）生产安全硬校验（启动时校验）

新增模块 `backend/app/core/security.py` 提供 `validate_production_security()`：

- 以 `ENVIRONMENT=production` 作为生产开关（默认 development）
- 生产环境下必须满足：
  - `JWT_SECRET_KEY` 必须显式设置且不是占位值
  - `ADMIN_DEFAULT_PASSWORD` 必须显式设置且不是默认弱口令（例如 8888）
  - `CORS_ORIGINS` 不允许为 `*`
- 不满足则 `raise RuntimeError(中文错误信息)`，阻止后端启动

接入位置：`backend/app/api/main.py` 的启动生命周期（startup/lifespan）中调用。

### 4）部署配置调整

- Render：在 `render.yaml` 增加 `ENVIRONMENT=production`，并把 `CORS_ORIGINS` 改为必须由用户填写（不再默认 `*`）。
- README：补充“生产环境必填项”说明（JWT_SECRET_KEY、ADMIN_DEFAULT_PASSWORD、CORS_ORIGINS）。

## 测试与验收

- 单测：
  - 取消深度学习任务后，会话与 SystemState 的 `status` 不再为 `深度学习中`
  - 生产安全校验：production + 危险配置会抛出异常；development 不抛
- 回归：
  - 管理员页取消任务后，任务状态变为“已取消”，系统状态可继续运行

