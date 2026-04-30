# 后台任务治理与诊断增强（继续完善）设计稿

日期：2026-04-30  
目标：进一步把系统从“可用”提升到“可长期运行、可排障、可控”的生产级形态。

## 背景问题

1. 后端存在多处 `asyncio.create_task(...)`，虽然目前用 `_background_tasks` 强引用避免被 GC，但缺少：
   - 任务元数据（类型/靴号/创建时间/当前状态/最后错误）
   - 去重策略（同类任务重复启动）
   - 取消/停止能力（只能等任务自然结束）
   - 对外可观测（前端无法看到后台任务是否在跑、跑到哪里）
2. 单测输出仍出现 `ResourceWarning`（HTTPError 未显式关闭），长期会掩盖真正的资源泄露信号。
3. 诊断接口 `/api/system/diagnostics` 的部分文案仍包含面向开发者的英文键名（例如 `OPENAI_API_KEY`），需要收敛为用户可理解中文提示。

## 设计目标

- 后台任务可治理：可登记、可查询、可去重、可取消、可记录异常。
- 诊断可用：诊断接口返回“后台任务概要”，且面向用户的提示只用中文（允许保留“AI”）。
- 测试输出干净：修掉现有 `ResourceWarning`，避免误导排障。

## 核心设计

### 1）后台任务注册表 TaskRegistry

新增模块：`backend/app/services/game/task_registry.py`

数据结构：

- `TaskMeta`：`task_id`、`task_type`、`boot_number`、`created_at`、`status`（running/succeeded/failed/cancelled）、`message`、`error`
- `TaskRegistry`：维护 `task_id -> (task, meta)`，并提供：
  - `create(task_type, coro, boot_number, dedupe_key)`：创建任务并注册
  - `list()`：返回所有 meta（默认只返回最近 N 个）
  - `cancel(task_id)`：取消任务
  - `cancel_by_key(dedupe_key)`：取消同类任务

去重策略（最小可用）：

- 同一 `dedupe_key`（例如 `deep_learning:boot=12`、`ai_learning:boot=0`）只允许一个 running
- 重复请求返回“已在执行中”的任务 meta（而不是再创建一个）

### 2）接入点

- 深度学习：`backend/app/services/game/boot.py` 的 `run_deep_learning` 任务由注册表创建并可追踪
- 管理员全库学习：`backend/app/api/routes/analysis.py` 的后台学习任务也纳入注册表
- 现有 `add_background_task` 保留兼容，但内部委托给注册表（避免大范围改动）

### 3）新增诊断接口：后台任务列表/取消

新增到 `backend/app/api/routes/system.py`（需管理员认证）：

- `GET /api/system/tasks`：列出最近任务（meta 列表）
- `POST /api/system/tasks/{task_id}/cancel`：取消指定任务

同时在 `GET /api/system/diagnostics` 增加：

- `background_tasks`: `{ running_count, running_types, latest_errors }`

### 4）修复测试 ResourceWarning

调整 `backend/tests/test_upload_modes.py` 的 `_post_json`：

- 捕获 `urllib.error.HTTPError` 后，`e.read()` 之后显式 `e.close()`，避免资源告警。

### 5）诊断中文化

将 diagnostics 里对用户暴露的 issue 字段统一为中文提示，不直接暴露 `OPENAI_API_KEY` 等键名：

- 例如：`"接口密钥未配置"`、`"庄模型接口未配置"` 等。

## 验收标准

- 后端新增：可列出后台任务、可取消任务、重复启动同类任务不会造成并行重复执行。
- 前端（暂不强制新增页面）：系统状态面板可从 diagnostics 获取到任务摘要（后续可再把 UI 做出来）。
- 单测与构建：后端 tests 输出无 `ResourceWarning`；前端 lint/build 继续通过。

