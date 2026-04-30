# 继续完善：任务面板 + Postgres 备份恢复 + Render 部署 + 更严格全中文 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为管理员提供后台任务可视化与取消能力；补齐 Postgres 备份/恢复脚本与文档；完善 Render 部署配置与中文指引；进一步清扫用户可见英文（保留 AI）。

**Architecture:** 前端在 AdminPage 增加“后台任务”Tab，调用后端 `/api/system/tasks` 与取消接口；SystemStatusPanel 从 diagnostics 展示运行中任务摘要；运维脚本基于 pg_dump/pg_restore；render.yaml 与 README 完整中文化与可验证步骤。

**Tech Stack:** React + Ant Design；FastAPI 已提供接口；Shell 脚本（pg_dump/pg_restore）；Render。

---

## Task 1：后端任务接口前端接入（API 层）

**Files:**
- Modify: `/workspace/frontend/src/services/api.ts`

- [ ] **Step 1: 增加类型与方法**

在 `api.ts` 中新增：

```ts
export type BackgroundTaskStatus = 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface BackgroundTaskItem {
  task_id: string;
  task_type: string;
  boot_number: number | null;
  dedupe_key: string | null;
  created_at: string;
  status: BackgroundTaskStatus;
  message: string;
  error: string | null;
}

export const getSystemTasks = async (limit = 50) => {
  return api.get<{ tasks: BackgroundTaskItem[] }>('/system/tasks', { params: { limit } });
};

export const cancelSystemTask = async (taskId: string) => {
  return api.post<{ success: boolean }>(`/system/tasks/${taskId}/cancel`);
};
```

- [ ] **Step 2: 构建校验**

Run: `npm run build`  
Expected: PASS

---

## Task 2：管理员页增加“后台任务”面板

**Files:**
- Modify: `/workspace/frontend/src/pages/AdminPage.tsx`
- (Optional Create if needed): `/workspace/frontend/src/components/admin/TaskPanel.tsx`

- [ ] **Step 1: 实现任务面板组件**

在 AdminPage 内或单独组件实现：
- 自动轮询：`setInterval` 每 3 秒刷新（只在 Tab=任务 时启用）
- 表格列：类型、靴号、状态、创建时间、消息、失败原因、task_id
- 操作：取消（仅 running），复制 task_id（`navigator.clipboard.writeText`）

表格状态展示建议：
- running：蓝色 Tag“运行中”
- succeeded：绿色 Tag“已完成”
- failed：红色 Tag“失败”
- cancelled：灰色 Tag“已取消”

- [ ] **Step 2: 与现有 Tabs 合并**

在 AdminPage 的 `Tabs` items 中新增一个 key：`tasks`，label：`后台任务`，icon 可复用现有 `Icons.Experiment/Robot`。

- [ ] **Step 3: 验证**

Run: `npm run lint`  
Expected: PASS

Run: `npm run build`  
Expected: PASS

---

## Task 3：系统状态面板展示“运行中任务”

**Files:**
- Modify: `/workspace/frontend/src/hooks/useSystemDiagnostics.ts`
- Modify: `/workspace/frontend/src/components/ui/SystemStatusPanel.tsx`

- [ ] **Step 1: 扩展 diagnostics 类型并解析 background_tasks**

在 hook 里把后端返回的 `background_tasks` 映射到 `SystemDiagnostics`：
- `running_count`
- `running_types`
- `latest_errors`

- [ ] **Step 2: UI 展示**

在 SystemStatusPanel：
- compact 模式下：若 `running_count > 0`，在右侧加一个 Tag，例如 `运行中 2`
- 展开模式下：新增一行“后台任务”，展示运行数与类型（例如：`深度学习、AI学习`）

- [ ] **Step 3: 构建校验**

Run: `npm run build`  
Expected: PASS

---

## Task 4：Postgres 备份/恢复脚本

**Files:**
- Create: `/workspace/backend/scripts/pg_backup.sh`
- Create: `/workspace/backend/scripts/pg_restore.sh`
- Modify: `/workspace/README.md`

- [ ] **Step 1: 备份脚本**

Create `backend/scripts/pg_backup.sh`：

```bash
#!/usr/bin/env bash
set -euo pipefail

OUT_DIR="${OUT_DIR:-./backups}"
mkdir -p "$OUT_DIR"

TS="$(date +%Y%m%d_%H%M%S)"
OUT_FILE="${OUT_FILE:-$OUT_DIR/pg_${TS}.dump}"

export PGPASSWORD="${PGPASSWORD:-}"

if [[ -n "${DATABASE_URL:-}" ]]; then
  pg_dump --format=c --no-owner --no-privileges "$DATABASE_URL" -f "$OUT_FILE"
else
  : "${PGHOST:?缺少 PGHOST}"
  : "${PGPORT:?缺少 PGPORT}"
  : "${PGUSER:?缺少 PGUSER}"
  : "${PGDATABASE:?缺少 PGDATABASE}"
  pg_dump --format=c --no-owner --no-privileges -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" "$PGDATABASE" -f "$OUT_FILE"
fi

echo "备份完成：$OUT_FILE"
```

- [ ] **Step 2: 恢复脚本**

Create `backend/scripts/pg_restore.sh`：

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_FILE="${1:-}"
if [[ -z "$BACKUP_FILE" || ! -f "$BACKUP_FILE" ]]; then
  echo "用法：PGPASSWORD=... DATABASE_URL=... $0 /path/to/backup.dump"
  exit 2
fi

export PGPASSWORD="${PGPASSWORD:-}"

if [[ -n "${DATABASE_URL:-}" ]]; then
  pg_restore --clean --if-exists --no-owner --no-privileges -d "$DATABASE_URL" "$BACKUP_FILE"
else
  : "${PGHOST:?缺少 PGHOST}"
  : "${PGPORT:?缺少 PGPORT}"
  : "${PGUSER:?缺少 PGUSER}"
  : "${PGDATABASE:?缺少 PGDATABASE}"
  pg_restore --clean --if-exists --no-owner --no-privileges -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" "$BACKUP_FILE"
fi

echo "恢复完成：$BACKUP_FILE"
```

- [ ] **Step 3: README 增加备份恢复章节（中文）**

在 README 增加：
- docker compose 环境如何备份/恢复（可用 `docker exec baccarat-postgres ...` 或本机安装 pg_dump）
- Render 环境如何备份（用 DATABASE_URL）

---

## Task 5：Render 部署完善 + README 中文化清扫

**Files:**
- Modify: `/workspace/render.yaml`
- Modify: `/workspace/README.md`

- [ ] **Step 1: render.yaml envVars 补齐**

后端增加必填项：
- JWT_SECRET_KEY
- ADMIN_DEFAULT_PASSWORD
- CORS_ORIGINS

并把 AI key 标为可选项（用户自行配置）。

- [ ] **Step 2: README 增加 Render 部署章节（中文）**

内容包括：
- 后端服务、前端静态站点、数据库的创建与绑定
- 必填环境变量清单
- 验证方法（health、/docs、前端访问）

- [ ] **Step 3: README 英文叙述清扫（保留命令与键名）**

将 README 中明显英文标题/段落替换为中文描述（保留 AI 与必要键名）。

- [ ] **Step 4: 验证**

Run: `npm run build`  
Expected: PASS

Run: `python -m unittest discover -s backend/tests -p 'test_*.py' -v`  
Expected: PASS

---

## Plan 自检

- 覆盖检查：任务面板、PG 备份恢复、Render 部署与中文化均有任务覆盖。
- 占位扫描：无 TBD/TODO；每个任务提供明确文件路径、代码块与验证命令。

