# 继续完善：任务面板 + Postgres 备份恢复 + Render 部署 + 更严格全中文（保留 AI）

日期：2026-04-30  
范围：前端（管理员页/系统状态）、后端（诊断与任务接口已具备）、运维脚本（Postgres）、部署文档（Render）、文案（全中文）

## 目标

1. 管理员可在前端直观看到后台任务（深度学习/学习任务等）的运行状态、失败原因，并可一键取消。
2. 提供 Postgres 的可落地备份与恢复方案（脚本 + 文档），满足生产运维基本要求。
3. Render 部署信息补齐：环境变量与操作步骤中文化、可复制、可验证。
4. 更严格全中文（保留“AI”）：界面与文档不出现英文叙述与英文错误码；命令、配置键名（如 DATABASE_URL）允许保留。

## 现状

- 后端已完成后台任务治理（TaskRegistry），并新增：
  - `GET /api/system/tasks`：任务列表（管理员）
  - `POST /api/system/tasks/{task_id}/cancel`：取消任务（管理员）
  - `/api/system/diagnostics` 已包含 `background_tasks` 摘要与中文提示
- 前端目前没有任务面板；SystemStatusPanel 也尚未展示后台任务摘要。
- Postgres 已在 docker compose 中默认提供，但缺少备份/恢复脚本。
- Render 配置可运行，但环境变量说明不全，README 仍有较多英文段落。

## 设计

### 一、任务前端面板

**位置**
- 管理员页新增 Tab：`后台任务`（与现有 AI/数据库等 Tab 并列）
- 系统状态面板：展示“运行中任务数”提示（不展开时也能看到），点击后引导到管理员页（可选）

**功能**
- 表格字段：任务类型、靴号、状态、创建时间、消息、失败原因、任务编号（task_id）
- 操作：取消任务（仅运行中）、复制 task_id
- 刷新：手动刷新 + 自动轮询（默认 3–5 秒；页面离开自动停止）

**权限**
- 仅管理员可见（复用现有 token 机制与后端鉴权）

### 二、Postgres 备份与恢复

**脚本**
- `backend/scripts/pg_backup.sh`
  - 输入：`DATABASE_URL` 或 `PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE`
  - 输出：按日期命名的备份文件（默认 `backups/pg_YYYYMMDD_HHMMSS.dump`）
  - 不回显密钥，不打印完整连接串
- `backend/scripts/pg_restore.sh`
  - 输入：备份文件路径 + 目标库连接信息
  - 支持 “恢复前自动创建库”（可选，默认不做，避免误操作）

**说明**
- README 增加“备份/恢复”章节：包含 docker compose 场景与 Render 场景两套命令。

### 三、Render 部署完善

- `render.yaml` 增加/补齐 envVars：
  - 后端：JWT_SECRET_KEY、ADMIN_DEFAULT_PASSWORD、CORS_ORIGINS、（可选）OPENAI/ANTHROPIC/GEMINI keys、DEBUG
  - 前端：VITE_API_BASE_URL、VITE_WS_URL
- README 增加“Render 部署（中文）”章节：从 0 到上线的可执行步骤，并提供验证清单（health、/docs、前端访问、WS）

### 四、更严格全中文（保留 AI）

范围：
- README 与 docs：标题、段落描述、术语统一中文；命令与配置键名可保留英文。
- 前端：继续清理零散英文（例如 “Network Error” 已做；检查剩余提示/按钮/tooltip 等）。
- 后端：对外错误 detail 保持中文，避免返回英文错误码（已基本满足，新增内容继续遵循）。

## 验收标准

- 管理员页可查看任务列表；触发学习后能看到任务出现与状态变化；取消任务生效。
- 备份脚本可生成可用备份文件；恢复脚本可恢复到指定数据库（以 docker compose 环境验证）。
- Render 部署按中文文档可复现，并能验证服务健康。
- 用户可见页面与 README 文档无英文叙述与英文错误码（保留 AI 与必要的配置键名/命令）。

