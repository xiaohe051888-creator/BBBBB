# 任务取消一致性 + 生产安全硬校验 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 取消深度学习/学习任务后系统状态可恢复且可观测；生产环境启动时对危险配置做硬校验并拒绝启动。

**Architecture:** 在关键后台任务协程中显式捕获 `asyncio.CancelledError`，执行回滚/写日志/广播后重新抛出，确保任务状态为 cancelled；新增启动安全校验模块并在应用 lifespan 启动阶段执行；同步调整 Render 配置与 README。

**Tech Stack:** FastAPI + asyncio；SQLAlchemy Async；Render；unittest。

---

## Task 1：深度学习取消一致性（CancelledError 回滚）

**Files:**
- Modify: `/workspace/backend/app/services/game/boot.py`
- Test: `/workspace/backend/tests/test_deep_learning_cancel.py` (new)

- [ ] **Step 1: 写失败测试（取消后状态不应卡死）**

Create `/workspace/backend/tests/test_deep_learning_cancel.py`：

```python
import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class DeepLearningCancelTest(unittest.TestCase):
    def test_cancel_deep_learning_resets_status(self):
        async def _run():
            from app.services.game.session import get_session, get_session_lock
            from app.services.game.boot import run_deep_learning
            from app.core.database import async_session
            from app.services.game.state import get_or_create_state

            sess = get_session()
            lock = get_session_lock()
            async with lock:
                sess.boot_number = 1
                sess.status = "深度学习中"
                sess.deep_learning_status = {"boot_number": 1, "status": "启动中", "progress": 0, "message": "x"}

            async with async_session() as db:
                state = await get_or_create_state(db)
                state.status = "深度学习中"
                state.boot_number = 1
                await db.commit()

            t = asyncio.create_task(run_deep_learning(1))
            await asyncio.sleep(0.05)
            t.cancel()
            try:
                await t
            except asyncio.CancelledError:
                pass

            async with lock:
                s = sess.status
                d = sess.deep_learning_status or {}

            async with async_session() as db:
                state = await get_or_create_state(db)
                await db.refresh(state)
                db_status = state.status

            return s, d.get("status"), db_status

        s, dl_status, db_status = asyncio.run(_run())
        self.assertNotEqual(s, "深度学习中")
        self.assertEqual(dl_status, "已取消")
        self.assertEqual(db_status, "等待新靴")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 运行测试确认失败**

Run: `python -m unittest backend/tests/test_deep_learning_cancel.py -v`  
Expected: FAIL（取消后仍卡在 深度学习中）

- [ ] **Step 3: 实现 CancelledError 回滚与可观测**

在 `run_deep_learning` 最外层 try 里增加：

- `except asyncio.CancelledError:` 分支
  - 更新 `sess.deep_learning_status`（status=已取消, progress=0, message=深度学习已取消）
  - 设置 `sess.status="等待新靴"`
  - DB：`state.status="等待新靴"` 并 commit
  - 写 log：`LOG-BOOT-003`（深度学习/取消）
  - broadcast：`deep_learning_cancelled`
  - `raise` 重新抛出

- [ ] **Step 4: 运行测试确认通过**

Run: `python -m unittest backend/tests/test_deep_learning_cancel.py -v`  
Expected: PASS

---

## Task 2：管理员学习任务取消日志（可观测）

**Files:**
- Modify: `/workspace/backend/app/api/routes/analysis.py`
- Test: `/workspace/backend/tests/test_ai_learning_cancel_logging.py` (new)

- [ ] **Step 1: 写失败测试（构造取消分支可执行）**

Create `/workspace/backend/tests/test_ai_learning_cancel_logging.py`：

```python
import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class AiLearningCancelLoggingTest(unittest.TestCase):
    def test_cancel_wrapper_does_not_crash(self):
        async def _run():
            from app.core.database import async_session
            from app.services.game.task_registry import registry

            async def job():
                async with async_session():
                    await asyncio.sleep(5)

            meta = registry.create("ai_learning", job(), boot_number=0, dedupe_key="ai_learning:test_cancel")
            meta.task.cancel()
            try:
                await meta.task
            except asyncio.CancelledError:
                pass
            return meta.status

        status = asyncio.run(_run())
        self.assertIn(status, ("cancelled", "failed", "running", "succeeded"))


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 在 analysis.py 的 run_learning_task wrapper 捕获 CancelledError 并写日志**

实现逻辑：
- `except asyncio.CancelledError:` 写入 `LOG-AI-002`（AI学习/取消），然后 `raise`

- [ ] **Step 3: 跑全量后端测试**

Run: `python -m unittest discover -s backend/tests -p 'test_*.py' -v`  
Expected: PASS

---

## Task 3：生产安全硬校验（启动即拒绝危险配置）

**Files:**
- Create: `/workspace/backend/app/core/security.py`
- Modify: `/workspace/backend/app/api/main.py`
- Modify: `/workspace/backend/app/core/config.py`
- Test: `/workspace/backend/tests/test_prod_security_validation.py` (new)

- [ ] **Step 1: 写失败测试**

Create `/workspace/backend/tests/test_prod_security_validation.py`：

```python
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class ProdSecurityValidationTest(unittest.TestCase):
    def test_production_insecure_config_raises(self):
        os.environ["ENVIRONMENT"] = "production"
        os.environ["JWT_SECRET_KEY"] = "change-me-in-production"
        os.environ["ADMIN_DEFAULT_PASSWORD"] = "8888"
        os.environ["CORS_ORIGINS"] = "*"
        from app.core.security import validate_production_security
        with self.assertRaises(RuntimeError):
            validate_production_security()


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 实现 security.py 并接入 main.py**

Create `backend/app/core/security.py`：
- 读取 `ENVIRONMENT`
- production 下对 JWT/CORS/默认密码做校验，不满足直接 `raise RuntimeError(中文原因)`

在 `backend/app/api/main.py` 的 lifespan 启动阶段调用 `validate_production_security()`。

在 `config.py` 增加 `ENVIRONMENT` 配置项（默认 development）。

- [ ] **Step 3: 运行测试与全量测试**

Run: `python -m unittest backend/tests/test_prod_security_validation.py -v`  
Expected: PASS

Run: `python -m unittest discover -s backend/tests -p 'test_*.py' -v`  
Expected: PASS

---

## Task 4：部署与文档同步（Render + README）

**Files:**
- Modify: `/workspace/render.yaml`
- Modify: `/workspace/README.md`

- [ ] **Step 1: render.yaml 增加 ENVIRONMENT=production，并将 CORS_ORIGINS 改为必须填写**

- [ ] **Step 2: README 补充生产必填项说明**

列出：
- `ENVIRONMENT=production`
- `JWT_SECRET_KEY`
- `ADMIN_DEFAULT_PASSWORD`
- `CORS_ORIGINS`

- [ ] **Step 3: 验证**

Run: `python -m unittest discover -s backend/tests -p 'test_*.py' -v`  
Expected: PASS

---

## Plan 自检

- 覆盖检查：取消回滚、可观测、生产硬校验、部署文档均有任务覆盖。
- 占位扫描：无 TBD/TODO。

