# 首页严重告警确认隐藏 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 管理员在首页看到严重告警条后，点击一次“确认”即可让首页告警条消失；记录页保留全部日志；后续出现新的高优先级告警时首页自动恢复提示。

**Architecture:** 后端在 `admin_users` 表保存管理员已确认到的最新严重告警 `SystemLog.id`（`acknowledged_alert_log_id`）。`GET /api/admin/maintenance/alerts` 返回最新告警 id、已确认 id 及未确认数量；前端 `AdminAlertsBar` 以 `unacknowledged_count` 决定是否显示，并提供 `确认` 按钮调用 `POST /api/admin/maintenance/alerts/acknowledge`。

**Tech Stack:** FastAPI + SQLAlchemy + Alembic, React + TypeScript + Ant Design, Vitest, Python unittest (TestClient)

---

## File Map

**Backend**
- Modify: `backend/app/models/schemas.py`（AdminUser 增字段）
- Create: `backend/alembic/versions/20260510_0008_admin_alert_ack.py`（新增迁移）
- Modify: `backend/app/api/routes/maintenance.py`（扩展 alerts + 新增 acknowledge）
- Modify: `backend/app/api/routes/schemas.py`（新增请求体 schema）
- Modify: `backend/tests/test_admin_maintenance_api.py`（新增单测）

**Frontend**
- Modify: `frontend/src/services/api.ts`（扩展 alerts response 类型 + 新增 acknowledge API）
- Modify: `frontend/src/components/dashboard/AdminAlertsBar.tsx`（新增确认按钮 + 显示逻辑改为 unacknowledged）
- Create/Modify: `frontend/src/components/dashboard/AdminAlertsBar.ack.test.tsx`（新增确认隐藏回归测试）

---

### Task 1: Backend — 数据迁移与模型字段

**Files:**
- Modify: `backend/app/models/schemas.py`
- Create: `backend/alembic/versions/20260510_0008_admin_alert_ack.py`
- Test: `backend/tests/test_migration_head_check.py`（只需跑，不新增代码）

- [ ] **Step 1: 写迁移红测（migration head 检查即可）**

Run:
```bash
cd /workspace/backend
pytest -q tests/test_migration_head_check.py
```
Expected: FAIL（因为还没有新迁移文件/heads 不匹配）

- [ ] **Step 2: 新增 Alembic migration**

Create `backend/alembic/versions/20260510_0008_admin_alert_ack.py`：
```python
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "20260510_0008"
down_revision = "20260509_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())
    if "admin_users" not in tables:
        return
    cols = {c["name"] for c in inspector.get_columns("admin_users")}
    with op.batch_alter_table("admin_users") as batch:
        if "acknowledged_alert_log_id" not in cols:
            batch.add_column(sa.Column("acknowledged_alert_log_id", sa.Integer(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())
    if "admin_users" not in tables:
        return
    cols = {c["name"] for c in inspector.get_columns("admin_users")}
    with op.batch_alter_table("admin_users") as batch:
        if "acknowledged_alert_log_id" in cols:
            batch.drop_column("acknowledged_alert_log_id")
```

- [ ] **Step 3: 更新 SQLAlchemy 模型**

Modify `backend/app/models/schemas.py`，在 `class AdminUser(Base)` 增加一列（保持字段顺序靠近其他状态字段）：
```python
acknowledged_alert_log_id = Column(Integer, nullable=True, comment="已确认到的最新严重告警日志ID")
```

- [ ] **Step 4: 重新跑迁移 head 检查**

Run:
```bash
cd /workspace/backend
pytest -q tests/test_migration_head_check.py
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/alembic/versions/20260510_0008_admin_alert_ack.py backend/app/models/schemas.py
git commit -m "feat: persist admin alert acknowledgement marker"
```

---

### Task 2: Backend — 扩展 alerts 返回 + 新增 acknowledge 接口（TDD）

**Files:**
- Modify: `backend/app/api/routes/maintenance.py`
- Modify: `backend/app/api/routes/schemas.py`
- Modify: `backend/tests/test_admin_maintenance_api.py`

- [ ] **Step 1: 写 failing tests（新增 3 个用例）**

Modify `backend/tests/test_admin_maintenance_api.py`，在 `AdminMaintenanceApiTest` 中新增：
```python
    def test_alerts_include_ack_fields(self):
        async def _seed():
            from datetime import datetime, timedelta
            from app.core.database import init_db, async_session
            from app.models.schemas import SystemLog

            await init_db()
            async with async_session() as s:
                cutoff = datetime.now() - timedelta(hours=24)
                await s.execute(
                    SystemLog.__table__.delete().where(
                        SystemLog.priority == "P1",
                        SystemLog.log_time >= cutoff,
                    )
                )
                s.add(SystemLog(
                    log_time=datetime.now(),
                    boot_number=1,
                    game_number=9,
                    event_code="UT-P1-ALERT-1",
                    event_type="测试严重事件",
                    event_result="Exception",
                    description="严重告警1",
                    category="系统异常",
                    priority="P1",
                ))
                await s.commit()

        asyncio.run(_seed())

        self._ensure_admin_password("8888")
        client = TestClient(app)
        token = client.post("/api/admin/login", json={"password": "8888"}).json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        r = client.get("/api/admin/maintenance/alerts", headers=headers)
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertIn("latest_alert_log_id", body)
        self.assertIn("acknowledged_alert_log_id", body)
        self.assertIn("unacknowledged_count", body)
        self.assertEqual(body["count"], 1)
        self.assertEqual(body["unacknowledged_count"], 1)


    def test_acknowledge_alerts_hides_unacknowledged_count(self):
        self._ensure_admin_password("8888")
        client = TestClient(app)
        token = client.post("/api/admin/login", json={"password": "8888"}).json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        before = client.get("/api/admin/maintenance/alerts", headers=headers).json()
        latest = before.get("latest_alert_log_id")
        self.assertTrue(latest is not None)
        r = client.post("/api/admin/maintenance/alerts/acknowledge", headers=headers, json={"latest_alert_log_id": latest})
        self.assertEqual(r.status_code, 200)

        after = client.get("/api/admin/maintenance/alerts", headers=headers).json()
        self.assertEqual(after["unacknowledged_count"], 0)


    def test_acknowledge_is_monotonic(self):
        self._ensure_admin_password("8888")
        client = TestClient(app)
        token = client.post("/api/admin/login", json={"password": "8888"}).json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        body = client.get("/api/admin/maintenance/alerts", headers=headers).json()
        latest = body.get("latest_alert_log_id")
        self.assertTrue(latest is not None)

        r1 = client.post("/api/admin/maintenance/alerts/acknowledge", headers=headers, json={"latest_alert_log_id": latest})
        self.assertEqual(r1.status_code, 200)
        r2 = client.post("/api/admin/maintenance/alerts/acknowledge", headers=headers, json={"latest_alert_log_id": max(int(latest) - 1, 0)})
        self.assertEqual(r2.status_code, 200)

        after = client.get("/api/admin/maintenance/alerts", headers=headers).json()
        self.assertEqual(after["acknowledged_alert_log_id"], latest)
```

- [ ] **Step 2: 运行新增测试，确认 RED**

Run:
```bash
cd /workspace/backend
pytest -q tests/test_admin_maintenance_api.py::AdminMaintenanceApiTest::test_alerts_include_ack_fields -q
```
Expected: FAIL（缺字段/缺接口）

- [ ] **Step 3: 增加 request schema**

Modify `backend/app/api/routes/schemas.py` 新增：
```python
from pydantic import BaseModel, Field


class MaintenanceAlertsAcknowledgeRequest(BaseModel):
    latest_alert_log_id: int = Field(..., ge=0)
```

- [ ] **Step 4: 实现后端逻辑**

Modify `backend/app/api/routes/maintenance.py`：

1) 扩展 `GET /alerts`：
- 读取当前管理员用户名：`actor.get("username")`
- 查 `AdminUser`，取 `acknowledged_alert_log_id`
- 计算 `latest_alert_log_id`（logs[0].id if logs else None）
- 计算 `unacknowledged_count`
- 将 3 个字段加入返回

2) 新增 `POST /alerts/acknowledge`：
- 入参使用 `MaintenanceAlertsAcknowledgeRequest`
- 查询最近窗口内最新告警 id 作为 `effective_latest`
- 更新 `AdminUser.acknowledged_alert_log_id = max(existing, effective_latest)`
- commit 并返回 `{acknowledged_alert_log_id, latest_alert_log_id, unacknowledged_count}`

注意：
- 若 admin 不存在：`HTTPException(401, "管理员账号不存在")`（沿用现有口径）

- [ ] **Step 5: 运行测试，确认 GREEN**

Run:
```bash
cd /workspace/backend
pytest -q tests/test_admin_maintenance_api.py
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/routes/schemas.py backend/app/api/routes/maintenance.py backend/tests/test_admin_maintenance_api.py
git commit -m "feat: add admin alert acknowledgement api"
```

---

### Task 3: Frontend — API 类型与调用（TDD）

**Files:**
- Modify: `frontend/src/services/api.ts`
- Test: `frontend/src/services/adminAlertsApi.test.ts`

- [ ] **Step 1: 写 failing test**

Create `frontend/src/services/adminAlertsApi.test.ts`：
```ts
import { describe, expect, it, vi } from 'vitest';
import axios from 'axios';

import { adminMaintenanceAlerts, adminMaintenanceAcknowledgeAlerts } from './api';

vi.mock('axios', async () => {
  const actual: any = await vi.importActual('axios');
  return {
    default: {
      ...actual,
      create: () => ({
        get: vi.fn(),
        post: vi.fn(),
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
      }),
    },
  };
});

describe('admin maintenance alerts api', () => {
  it('exports acknowledge alerts call', () => {
    expect(typeof adminMaintenanceAlerts).toBe('function');
    expect(typeof adminMaintenanceAcknowledgeAlerts).toBe('function');
  });
});
```

- [ ] **Step 2: 运行测试确认 RED**

Run:
```bash
cd /workspace/frontend
npm test -- src/services/adminAlertsApi.test.ts
```
Expected: FAIL（`adminMaintenanceAcknowledgeAlerts` 不存在）

- [ ] **Step 3: 实现最小 API 方法 + 类型扩展**

Modify `frontend/src/services/api.ts`：

1) 扩展返回类型：
```ts
export interface AdminMaintenanceAlertsResponse {
  count: number;
  data: AdminMaintenanceAlertItem[];
  latest_alert_log_id?: number | null;
  acknowledged_alert_log_id?: number | null;
  unacknowledged_count?: number;
}
```

2) 新增方法：
```ts
export const adminMaintenanceAcknowledgeAlerts = async (latest_alert_log_id: number) => {
  return api.post('/admin/maintenance/alerts/acknowledge', { latest_alert_log_id });
};
```

- [ ] **Step 4: 运行测试确认 GREEN**

Run:
```bash
cd /workspace/frontend
npm test -- src/services/adminAlertsApi.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/api.ts frontend/src/services/adminAlertsApi.test.ts
git commit -m "feat: add alert acknowledge client api"
```

---

### Task 4: Frontend — AdminAlertsBar 增加“确认”并按未确认数显示（TDD）

**Files:**
- Modify: `frontend/src/components/dashboard/AdminAlertsBar.tsx`
- Create: `frontend/src/components/dashboard/AdminAlertsBar.ack.test.tsx`

- [ ] **Step 1: 写 failing test（确认后隐藏 + 新告警再出现）**

Create `frontend/src/components/dashboard/AdminAlertsBar.ack.test.tsx`：
```tsx
// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AdminAlertsBar } from './AdminAlertsBar';

const getAdminTokenMock = vi.fn();
const adminMaintenanceAlertsMock = vi.fn();
const adminMaintenanceAcknowledgeAlertsMock = vi.fn();

vi.mock('../../services/api', () => ({
  getAdminToken: () => getAdminTokenMock(),
  adminMaintenanceAlerts: (...args: unknown[]) => adminMaintenanceAlertsMock(...args),
  adminMaintenanceAcknowledgeAlerts: (...args: unknown[]) => adminMaintenanceAcknowledgeAlertsMock(...args),
}));

describe('AdminAlertsBar acknowledge', () => {
  afterEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('hides the bar after acknowledge but shows again when new alerts arrive', async () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: () => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });

    getAdminTokenMock.mockReturnValue('token');
    adminMaintenanceAlertsMock
      .mockResolvedValueOnce({
        data: {
          count: 1,
          unacknowledged_count: 1,
          latest_alert_log_id: 101,
          acknowledged_alert_log_id: null,
          data: [
            {
              id: 101,
              log_time: '2026-05-10T11:37:19Z',
              boot_number: 12,
              game_number: 24,
              event_code: 'UT-P1',
              event_type: '测试',
              event_result: 'Exception',
              description: '严重告警',
              category: '系统异常',
              priority: 'P1',
              source_module: 'analysis',
              task_id: 'task-1',
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          count: 1,
          unacknowledged_count: 0,
          latest_alert_log_id: 101,
          acknowledged_alert_log_id: 101,
          data: [],
        },
      })
      .mockResolvedValueOnce({
        data: {
          count: 2,
          unacknowledged_count: 1,
          latest_alert_log_id: 202,
          acknowledged_alert_log_id: 101,
          data: [
            {
              id: 202,
              log_time: '2026-05-10T11:39:19Z',
              boot_number: 12,
              game_number: 25,
              event_code: 'UT-P1-2',
              event_type: '测试2',
              event_result: 'Exception',
              description: '新的严重告警',
              category: '系统异常',
              priority: 'P1',
              source_module: 'analysis',
              task_id: 'task-2',
            },
          ],
        },
      });

    adminMaintenanceAcknowledgeAlertsMock.mockResolvedValue({ data: { acknowledged_alert_log_id: 101 } });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter>
          <AdminAlertsBar />
        </MemoryRouter>,
      );
    });
    expect(container.innerHTML).toContain('严重告警');

    const confirmButton = Array.from(document.querySelectorAll('button')).find((b) =>
      (b.textContent || '').replace(/\s+/g, '').includes('确认'),
    );
    expect(confirmButton).toBeTruthy();

    await act(async () => {
      confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await act(async () => {});
    expect(container.innerHTML).not.toContain('严重告警');

    await act(async () => {
      root.render(
        <MemoryRouter>
          <AdminAlertsBar />
        </MemoryRouter>,
      );
    });
    await act(async () => {});
    expect(container.innerHTML).toContain('严重告警');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
```

- [ ] **Step 2: 运行测试确认 RED**

Run:
```bash
cd /workspace/frontend
npm test -- src/components/dashboard/AdminAlertsBar.ack.test.tsx
```
Expected: FAIL（无确认按钮/逻辑未按 unacknowledged_count）

- [ ] **Step 3: 实现最小 UI/逻辑**

Modify `frontend/src/components/dashboard/AdminAlertsBar.tsx`：
- 从 `data` 读取 `unacknowledged_count`，并用它作为 `shouldShow = unacknowledged_count > 0`
- 若 `unacknowledged_count` 缺失（老后端/缓存），回退到 `count`
- 新增 `确认` 按钮：
  - disabled 条件：无 `latest_alert_log_id` 或正在 loading
  - 点击：调用 `api.adminMaintenanceAcknowledgeAlerts(latest_alert_log_id)`
  - 成功后：调用 `fetchAlerts()` 立即刷新，从而让 `unacknowledged_count` 归零并隐藏

- [ ] **Step 4: 运行测试确认 GREEN**

Run:
```bash
cd /workspace/frontend
npm test -- src/components/dashboard/AdminAlertsBar.ack.test.tsx
```
Expected: PASS

- [ ] **Step 5: 跑关联回归与构建**

Run:
```bash
cd /workspace/frontend
npm test -- src/components/dashboard/AdminAlertsBar.test.tsx src/components/dashboard/AdminAlertsBar.ack.test.tsx
npm run build
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/dashboard/AdminAlertsBar.tsx frontend/src/components/dashboard/AdminAlertsBar.ack.test.tsx
git commit -m "feat: acknowledge severe alerts on dashboard"
```

---

### Task 5: End-to-end sanity (local) + push

**Files:**
- None (verification + push only)

- [ ] **Step 1: Backend tests**

Run:
```bash
cd /workspace/backend
pytest -q tests/test_admin_maintenance_api.py
```
Expected: PASS

- [ ] **Step 2: Frontend tests + build**

Run:
```bash
cd /workspace/frontend
npm test -- src/components/dashboard/AdminAlertsBar.test.tsx src/components/dashboard/AdminAlertsBar.ack.test.tsx
npm run build
```
Expected: PASS

- [ ] **Step 3: Push**

```bash
git push origin decision-hub-delivery:main
```

