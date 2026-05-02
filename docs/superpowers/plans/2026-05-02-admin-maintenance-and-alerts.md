# 管理页维护面板 + 管理员告警条 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 管理员能在页面上看到数据体积/数量、手动触发清理，并在 Dashboard 看到 P1 告警列表。

**Architecture:** 后端提供 admin-only 维护 API（stats/alerts/retention-run）；前端 AdminPage 显示统计与按钮，DashboardPage 轮询 alerts 显示告警条；不引入外部通知与复杂工单。

**Tech Stack:** FastAPI + SQLAlchemy Async + React + Ant Design + React Router。

---

### Task 1: 后端维护 API（先写测试）

**Files:**
- Create: `/workspace/backend/app/api/routes/maintenance.py`
- Modify: `/workspace/backend/app/api/main.py`
- Create: `/workspace/backend/tests/test_admin_maintenance_api.py`

- [ ] **Step 1: 写失败用例（401 + 正常返回）**

Create `backend/tests/test_admin_maintenance_api.py`:

```python
import os
import sys
import unittest

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.api.main import app


class AdminMaintenanceApiTest(unittest.TestCase):
    def test_stats_requires_auth(self):
        client = TestClient(app)
        r = client.get("/api/admin/maintenance/stats")
        self.assertEqual(r.status_code, 401)

    def test_stats_and_alerts_work_with_token(self):
        client = TestClient(app)
        token = client.post("/api/admin/login", json={"password": "8888"}).json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        r = client.get("/api/admin/maintenance/stats", headers=headers)
        self.assertEqual(r.status_code, 200)
        self.assertIn("counts", r.json())

        r2 = client.get("/api/admin/maintenance/alerts", headers=headers)
        self.assertEqual(r2.status_code, 200)
        self.assertIn("count", r2.json())

    def test_retention_run_returns_summary(self):
        client = TestClient(app)
        token = client.post("/api/admin/login", json={"password": "8888"}).json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        r = client.post("/api/admin/maintenance/retention/run", headers=headers)
        self.assertEqual(r.status_code, 200)
        self.assertIn("deleted", r.json())


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 实现 maintenance 路由**

Create `backend/app/api/routes/maintenance.py`，提供：
- `GET /api/admin/maintenance/stats`
- `GET /api/admin/maintenance/alerts`
- `POST /api/admin/maintenance/retention/run`

要求：
- 三个接口均依赖 `get_current_user`
- `stats` 返回：counts + config + sqlite_size_bytes（非 sqlite 时为 null）
- `alerts` 返回：最近 P1 日志（默认 24h、limit 20）
- `retention/run` 执行 `cleanup_logs + prune_history` 并写入 P2 日志 `LOG-MAINT-RET`

- [ ] **Step 3: 挂载路由**

在 `app/api/main.py` 里 include 该 router。

- [ ] **Step 4: 运行后端单测**

Run:
```bash
mkdir -p /workspace/data
python -m unittest backend/tests/test_admin_maintenance_api.py -v
python -m unittest discover -s backend/tests -p 'test_*.py' -v
```
Expected: PASS.

---

### Task 2: 前端 API 封装

**Files:**
- Modify: `/workspace/frontend/src/services/api.ts`

- [ ] **Step 1: 新增三个方法**

新增：
- `adminMaintenanceStats()`
- `adminMaintenanceAlerts(hours?: number, limit?: number)`
- `adminMaintenanceRunRetention()`

- [ ] **Step 2: TypeScript 类型定义**

为返回值增加必要的类型（counts/config/alerts data）。

---

### Task 3: AdminPage 增加维护区（数据库存储 Tab）

**Files:**
- Modify: `/workspace/frontend/src/pages/AdminPage.tsx`

- [ ] **Step 1: 在“数据库存储”Tab 增加统计区域**

展示：
- sqlite 文件大小（若为 null 则显示“非 sqlite / 不可用”）
- GameRecord/BetRecord/SystemLog 各数量
- P1/P2/P3 数量、pinned 数量

- [ ] **Step 2: 增加按钮**

按钮：
- “刷新统计”（重新拉 stats）
- “立即清理”（触发 retention/run，toast 显示删除量）

---

### Task 4: Dashboard 增加管理员告警条

**Files:**
- Create: `/workspace/frontend/src/components/dashboard/AdminAlertsBar.tsx`
- Modify: `/workspace/frontend/src/pages/DashboardPage.tsx`

- [ ] **Step 1: 新组件 AdminAlertsBar**

行为：
- 仅管理员登录（有 token）时拉取 alerts
- 有 P1 时显示红条（可展开列表，显示时间+事件+描述）
- “查看全部”链接到 `/logs?priority=P1`

- [ ] **Step 2: DashboardPage 引入并放在顶部**

- [ ] **Step 3: 前端 build**

Run:
```bash
cd /workspace/frontend && npm run build
```
Expected: build success.

