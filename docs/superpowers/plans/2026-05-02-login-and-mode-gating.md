# 登录即用 + 模式选择门槛（AI 需已测试通过）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 打开系统先登录（可关闭仅浏览只读），登录成功进入模式选择页；AI 模式仅当“已配置且测试通过”才允许启用；选好模式才进入系统主界面。

**Architecture:** 后端把“AI 可启用”做成最终门禁：测试接口写入 last_test_ok；更新配置会重置 last_test_ok；切换模式接口会拒绝未测试通过的 AI。前端增加 /mode 引导页与登录联动，按钮禁用仅作 UX，真正规则由后端兜底。

**Tech Stack:** FastAPI + SQLAlchemy + React + Ant Design + Axios。

---

## Task 1: 后端持久化 “API 测试通过”状态

**Files:**
- Inspect/Modify: `/workspace/backend/app/models/schemas.py`（API 配置/模型配置的 ORM 定义处）
- Modify: `/workspace/backend/app/api/routes/admin.py`（或 admin 路由文件：api-config/api-config-test 所在处）

- [ ] **Step 1: 找到保存 API 配置的表/模型**

确认当前存储 provider/model/base_url/api_key 的 ORM 模型与字段名，记录 role 对应关系（banker/player/combined/single）。

- [ ] **Step 2: 为该模型增加字段**

增加：
- `last_test_ok` (bool, default False)
- `last_test_at` (datetime, nullable)
- `last_test_error` (str, nullable)

- [ ] **Step 3: 更新配置时自动重置测试状态**

在更新配置的 handler（`/api/admin/api-config`）里，当任意配置字段变化时：
- `last_test_ok = False`
- `last_test_at = None`
- `last_test_error = None`

- [ ] **Step 4: 测试连通性接口写入测试结果**

在 `/api/admin/api-config/test`：
- 成功：写入 `last_test_ok=True, last_test_at=now, last_test_error=None`
- 失败：写入 `last_test_ok=False, last_test_at=now, last_test_error=<简短原因>`

- [ ] **Step 5: 回归测试（新增单测）**

Create `/workspace/backend/tests/test_api_config_test_persists_status.py`：

```python
import os
import sys
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.api.main import app


class ApiConfigTestPersistsStatusTest(unittest.TestCase):
    def test_test_endpoint_persists_last_test_ok(self):
        client = TestClient(app)

        token = client.post("/api/admin/login", json={"password": "8888"}).json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        client.post(
            "/api/admin/api-config",
            json={
                "role": "single",
                "provider": "openai",
                "model": "gpt-4o-mini",
                "api_key": "sk-test",
                "base_url": None,
            },
            headers=headers,
        )

        with patch("app.services.ai.openai_client.OpenAIClient.test_connection", return_value=True):
            r = client.post(
                "/api/admin/api-config/test",
                json={
                    "role": "single",
                    "provider": "openai",
                    "model": "gpt-4o-mini",
                    "api_key": "sk-test",
                    "base_url": None,
                },
                headers=headers,
            )
            self.assertEqual(r.status_code, 200)

        status = client.get("/api/admin/three-model-status", headers=headers).json()
        self.assertTrue(status["models"]["single"]["last_test_ok"])


if __name__ == "__main__":
    unittest.main()
```

Run:
```bash
python -m unittest backend/tests/test_api_config_test_persists_status.py -v
```

---

## Task 2: 后端模式切换门禁（AI 必须测试通过）

**Files:**
- Modify: `/workspace/backend/app/api/routes/system.py`
- Modify: `/workspace/backend/app/api/routes/admin.py`（three-model-status 输出）
- Modify: `/workspace/backend/tests/test_prediction_mode_gates.py`

- [ ] **Step 1: three-model-status 输出 last_test_ok 等字段**

让前端能拿到每个角色的：
- `api_key_set`
- `last_test_ok`
- `last_test_at`
- `last_test_error`

并增加聚合字段：
- `ai_ready_for_enable`
- `single_ai_ready_for_enable`

- [ ] **Step 2: prediction-mode 后端强制校验**

当 mode=ai：
- 必须 banker/player/combined 三个角色都 `api_key_set && last_test_ok`

当 mode=single_ai：
- 必须 single `api_key_set && last_test_ok`

否则返回 409，并在 detail 里给出中文提示（例如“请先配置并测试通过：庄/闲/综合模型”）。

- [ ] **Step 3: 更新/新增单测**

把 `/workspace/backend/tests/test_prediction_mode_gates.py` 扩展为：
- keys 缺失 -> 拒绝
- keys 有但 last_test_ok=false -> 拒绝
- last_test_ok=true -> 允许

---

## Task 3: 前端新增 /mode 模式选择页与登录联动

**Files:**
- Create: `/workspace/frontend/src/pages/ModeSelectPage.tsx`
- Modify: `/workspace/frontend/src/App.tsx`
- Modify: `/workspace/frontend/src/services/api.ts`
- Modify: `/workspace/frontend/src/hooks/useAdminLogin.ts`（或登录弹窗逻辑所在处）

- [ ] **Step 1: 新增 /mode 页面**

页面内容：
- 展示三个模式卡片：3AI / 单AI / 规则
- 读取 `getThreeModelStatus()` 或现有接口拿到 `ai_ready_for_enable` 等状态
- AI 不满足条件时：按钮禁用并展示原因

- [ ] **Step 2: 登录后跳转 /mode**

登录成功：
- 存 token
- 跳转 `/mode`

- [ ] **Step 3: 选中模式后才进入系统**

在 /mode 点击“启用规则/启用 AI”：
- 调用 `updatePredictionMode(mode)`
- 成功：跳转 `/dashboard`
- 失败：弹出后端返回的中文原因

- [ ] **Step 4: “打开就弹登录框，但可关闭浏览只读”**

实现策略：
- 首页/总览页检测无 token：自动打开登录弹窗
- 提供“暂不登录”按钮关闭弹窗（此时只读可看；写操作会再弹）

---

## Task 4: 前端：AI 模式必须“已测试通过”才能点

**Files:**
- Modify: `/workspace/frontend/src/pages/ModeSelectPage.tsx`
- Modify: `/workspace/frontend/src/pages/AdminPage.tsx`（配置/测试 API 的地方）

- [ ] admin 配置页里：测试通过后刷新 three-model-status，让 /mode 能立即变为可点
- [ ] /mode 里对 AI 模式禁用时显示：
  - 缺 key：提示“请先配置 API”
  - 未测试：提示“请先点击 测试连接 通过”
  - 测试失败：提示 last_test_error（简短）

---

## Task 5: 全量回归

- [ ] 后端全量 unittest

```bash
mkdir -p /workspace/data
python -m unittest discover -s backend/tests -p 'test_*.py' -v
```

- [ ] 前端依赖 + build

```bash
cd /workspace/frontend && npm ci && npm run build
```

