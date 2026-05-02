# 系统从 0 到 100 全面修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在“只需登录一次”的单用户体验前提下，补齐鉴权/WS/CORS 一致性，消除吞错导致的隐性故障，给后台任务加去重/节流，并修复 UI 交互歧义；最终通过全量回归验证。

**Architecture:** 后端以现有 JWT token 为核心：写操作与 WS 强制 token；CORS 仅由 CORSMiddleware 管控；关键 except 改为可诊断日志/系统日志；analysis 触发使用任务注册器 dedupe_key；前端把 token 持久化并注入 axios 与 WebSocket query。

**Tech Stack:** FastAPI + SQLAlchemy + JWT + React + Axios + WebSocket。

---

## Files

**Backend**
- Modify: [websocket.py](file:///workspace/backend/app/api/routes/websocket.py)
- Modify: [utils.py](file:///workspace/backend/app/api/routes/utils.py)
- Modify: [game.py](file:///workspace/backend/app/api/routes/game.py)
- Modify: [system.py](file:///workspace/backend/app/api/routes/system.py)
- Modify: [main.py](file:///workspace/backend/app/api/main.py)
- Modify: [task_registry.py](file:///workspace/backend/app/services/game/task_registry.py)

**Frontend**
- Modify: `/workspace/frontend/src/services/api.ts`
- Modify: `/workspace/frontend/src/services/ws.ts`（如存在；否则在现有 ws 连接处修改）
- Modify: `/workspace/frontend/src/pages/AdminPage.tsx`（或模式弹窗组件）

**Tests**
- Create: `/workspace/backend/tests/test_ws_requires_auth.py`
- Create: `/workspace/backend/tests/test_core_writes_require_auth.py`
- Create: `/workspace/backend/tests/test_analysis_dedupe.py`

---

### Task 1: 后端写操作统一要求鉴权（一次登录）

**Files:**
- Modify: [game.py](file:///workspace/backend/app/api/routes/game.py)
- Modify: [system.py](file:///workspace/backend/app/api/routes/system.py)

- [ ] **Step 1: 写失败用例（未登录应返回 401）**

Create `/workspace/backend/tests/test_core_writes_require_auth.py`：

```python
import os
import sys
import unittest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.api.main import app


class CoreWritesRequireAuthTest(unittest.TestCase):
    def test_upload_requires_auth(self):
        client = TestClient(app)
        r = client.post("/api/games/upload", json={"games": []})
        self.assertEqual(r.status_code, 401)

    def test_reveal_requires_auth(self):
        client = TestClient(app)
        r = client.post("/api/games/reveal", json={"game_number": 1, "result": "庄"})
        self.assertEqual(r.status_code, 401)

    def test_prediction_mode_requires_auth(self):
        client = TestClient(app)
        r = client.post("/api/system/prediction-mode", json={"mode": "rule"})
        self.assertEqual(r.status_code, 401)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 让 /upload /reveal /prediction-mode 引入 Depends(get_current_user)**

在对应路由函数签名里新增：

```python
from fastapi import Depends
from app.api.routes.utils import get_current_user

@router.post("/upload")
async def upload_game_results(req: UploadRequest, _: dict = Depends(get_current_user)):
    ...
```

对 `/reveal` 与 `/api/system/prediction-mode` 同样处理。

- [ ] **Step 3: 运行测试**

Run:
```bash
python -m unittest backend/tests/test_core_writes_require_auth.py -v
```

Expected: PASS

---

### Task 2: WebSocket 强制鉴权

**Files:**
- Modify: [websocket.py](file:///workspace/backend/app/api/routes/websocket.py)
- Modify: [utils.py](file:///workspace/backend/app/api/routes/utils.py)

- [ ] **Step 1: 写失败用例（无 token 不能连）**

Create `/workspace/backend/tests/test_ws_requires_auth.py`：

```python
import os
import sys
import unittest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.api.main import app


class WsRequiresAuthTest(unittest.TestCase):
    def test_ws_rejects_without_token(self):
        client = TestClient(app)
        with self.assertRaises(Exception):
            with client.websocket_connect("/ws"):
                pass


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: WS 读取 query token 并校验**

在 `websocket_endpoint`：
- 读取 `token = websocket.query_params.get("token")`
- 若为空：直接关闭连接
- 若存在：复用 `get_current_user` 的 token 校验逻辑（可提取一个 `decode_token(token)` 工具函数供 HTTP/WS 共用）

- [ ] **Step 3: 运行测试**

Run:
```bash
python -m unittest backend/tests/test_ws_requires_auth.py -v
```

Expected: PASS

---

### Task 3: CORS 行为一致化（避免异常时强行写 *）

**Files:**
- Modify: [main.py](file:///workspace/backend/app/api/main.py)

- [ ] **Step 1: 删除全局异常处理器中写入 Access-Control-Allow-Origin 的逻辑**

保留 JSON 错误响应，但不再硬写 CORS 头，让 CORSMiddleware 统一负责。

- [ ] **Step 2: allow_credentials 设为 False**

```python
allow_credentials=False
```

因为前端使用 Authorization token，不依赖 cookie。

---

### Task 4: 后台 analysis 触发去重/节流

**Files:**
- Modify: [game.py](file:///workspace/backend/app/api/routes/game.py)
- Modify: [task_registry.py](file:///workspace/backend/app/services/game/task_registry.py)

- [ ] **Step 1: 写失败用例（重复触发不应产生多个 running analysis）**

Create `/workspace/backend/tests/test_analysis_dedupe.py`：

```python
import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class AnalysisDedupeTest(unittest.TestCase):
    def test_analysis_dedupe_key_prevents_duplicates(self):
        async def _run():
            from app.services.game.task_registry import registry
            async def job():
                await asyncio.sleep(0.05)

            meta1 = registry.create("analysis", job(), boot_number=1, dedupe_key="analysis:1")
            meta2 = registry.create("analysis", job(), boot_number=1, dedupe_key="analysis:1")
            self.assertEqual(meta1.task_id, meta2.task_id)

        asyncio.run(_run())


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: upload/reveal 触发分析时使用 dedupe_key**

例如：
- upload：`analysis:{boot_number}`
- reveal：`analysis:{boot_number}`

- [ ] **Step 3: 运行测试**

Run:
```bash
python -m unittest backend/tests/test_analysis_dedupe.py -v
```

Expected: PASS

---

### Task 5: 吞错改为可诊断（最小修）

**Files:**
- Modify: [game.py](file:///workspace/backend/app/api/routes/game.py)
- Modify: [system.py](file:///workspace/backend/app/api/routes/system.py)

- [ ] 将关键 `except Exception: pass` 改为 `logger.exception(...)`（不输出密钥），并在必要时写入 SystemLog（P1/P2）。

---

### Task 6: 前端“只需登录一次” + WS 带 token

**Files:**
- Modify: `/workspace/frontend/src/services/api.ts`
- Modify: `/workspace/frontend/src/**`（WS 创建处）

- [ ] 登录成功后持久化 token（localStorage）
- [ ] axios 拦截器自动加 `Authorization: Bearer <token>`
- [ ] WS 连接 URL 改为 `/ws?token=<token>`

---

### Task 7: UI 文案歧义修正（模式弹窗多按钮同名）

**Files:**
- Modify: `/workspace/frontend/src/pages/AdminPage.tsx`（或相关组件）

- [ ] 将多个“启用”按钮文案改为明确模式名称，并对缺 key 模式禁用按钮+提示。

---

### Task 8: 全量回归

- [ ] 后端全量 unittest

```bash
mkdir -p /workspace/data
python -m unittest discover -s backend/tests -p 'test_*.py' -v
```

- [ ] 前端 build

```bash
cd /workspace/frontend && npm run build
```

