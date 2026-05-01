# 状态一致性加固（默认规则模式 / 严格门禁 / JWT 固化 / DB 路径固定）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 默认预测模式改为规则引擎（rule），并在后端强制“无 Key 不可切换 ai/single_ai”；启动时纠偏历史非法模式；同时固化 JWT_SECRET_KEY 与固定 SQLite 默认路径，消除“重启像丢配置/丢数据/模式不一致”。

**Architecture:**  
1) 默认 mode=rule：内存会话与 DB 初始 state 都用 rule；所有 `get(..., "ai")` 的默认值改为 rule。  
2) 严格门禁：`POST /api/system/prediction-mode` 按 Key 校验拒绝非法切换。  
3) 启动纠偏：若 DB/内存处于 ai/single_ai 但 Key 不齐，则启动时写回 rule。  
4) JWT 固化：启动前确保 `JWT_SECRET_KEY` 存在（若无则生成并写入 `backend/.env`，不打印密钥）。  
5) DB 路径固定：若未设置 `DATABASE_URL`，默认指向 `backend/data/baccarat.db` 的绝对路径。

**Tech Stack:** FastAPI + SQLAlchemy(Async) + python-dotenv；React + Vite。

---

## Files To Touch

**Backend**
- Modify: [config.py](file:///workspace/backend/app/core/config.py)
- Modify: [env_migration.py](file:///workspace/backend/app/core/env_migration.py)
- Modify: [main.py](file:///workspace/backend/app/api/main.py)
- Modify: [state.py](file:///workspace/backend/app/services/game/state.py)
- Modify: [session.py](file:///workspace/backend/app/services/game/session.py)
- Modify: [system.py](file:///workspace/backend/app/api/routes/system.py)
- Modify: [analysis.py](file:///workspace/backend/app/services/game/analysis.py)
- Modify: [analysis routes](file:///workspace/backend/app/api/routes/analysis.py)
- Test (modify): `/workspace/backend/tests/test_ai_analysis_fallbacks.py`
- Test (add): `/workspace/backend/tests/test_prediction_mode_gates.py`
- Test (add): `/workspace/backend/tests/test_default_mode_rule.py`

**Frontend**
- Modify: [AdminPage.tsx](file:///workspace/frontend/src/pages/AdminPage.tsx)（默认值从 rule 起步，防止首次渲染误导）

---

### Task 1: 默认模式改为 rule（TDD）

**Files:**
- Create: `/workspace/backend/tests/test_default_mode_rule.py`
- Modify: [state.py](file:///workspace/backend/app/services/game/state.py#L14-L32)
- Modify: [session.py](file:///workspace/backend/app/services/game/session.py#L12-L20)
- Modify: [system.py](file:///workspace/backend/app/api/routes/system.py)
- Modify: [analysis routes](file:///workspace/backend/app/api/routes/analysis.py#L15-L45)

- [ ] **Step 1: Write failing test**

```python
import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class DefaultModeRuleTest(unittest.TestCase):
    def test_default_prediction_mode_is_rule(self):
        async def _run():
            from app.services.game.session import clear_session
            from app.services.game import get_current_state

            clear_session()
            mem = await get_current_state()
            return mem.get("prediction_mode")

        mode = asyncio.run(_run())
        self.assertEqual(mode, "rule")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python -m unittest backend/tests/test_default_mode_rule.py -v
```

Expected: FAIL（当前默认是 ai）

- [ ] **Step 3: Implement default rule**

1) `ManualSession.prediction_mode` 默认值改为 `"rule"`  
2) `get_or_create_state()` 新建记录时 `prediction_mode="rule"`  
3) 所有状态接口的默认值从 `"ai"` 改为 `"rule"`（例如 `get_system_state`/`analysis/latest` 中的 `get(..., "ai")`）

- [ ] **Step 4: Run test to verify it passes**

```bash
python -m unittest backend/tests/test_default_mode_rule.py -v
```

Expected: PASS

---

### Task 2: 后端 prediction-mode 严格门禁（TDD）

**Files:**
- Create: `/workspace/backend/tests/test_prediction_mode_gates.py`
- Modify: [system.py](file:///workspace/backend/app/api/routes/system.py#L629-L650)

- [ ] **Step 1: Write failing test**

```python
import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class PredictionModeGatesTest(unittest.TestCase):
    def test_ai_mode_rejected_when_keys_missing(self):
        async def _run():
            from app.api.routes.system import update_prediction_mode, PredictionModeRequest
            req = PredictionModeRequest(mode="ai")
            try:
                await update_prediction_mode(req, _={})
            except Exception as e:
                return type(e).__name__
            return "no_error"

        name = asyncio.run(_run())
        self.assertNotEqual(name, "no_error")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python -m unittest backend/tests/test_prediction_mode_gates.py -v
```

Expected: FAIL（当前后端允许直接切 ai）

- [ ] **Step 3: Implement strict gates**

在 `update_prediction_mode` 中：

- `mode == "ai"`：必须 `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`/`GEMINI_API_KEY` 均有效（len>10）
- `mode == "single_ai"`：必须 `SINGLE_AI_API_KEY` 有效（len>10）
- 不满足直接 `HTTPException(400, "...")`（中文提示）

- [ ] **Step 4: Run test to verify it passes**

```bash
python -m unittest backend/tests/test_prediction_mode_gates.py -v
```

Expected: PASS

---

### Task 3: 启动纠偏（历史非法模式回落到 rule）

**Files:**
- Modify: [main.py](file:///workspace/backend/app/api/main.py#L86-L103)
- Modify: [state.py](file:///workspace/backend/app/services/game/state.py#L70-L87)（如需复用辅助函数）

- [ ] **Step 1: 在 lifespan 初始化完成后校验 prediction_mode**

逻辑：
- 如果 DB state 或 mem_sess 是 `ai` 但三 key 不齐：写回 `rule`
- 如果是 `single_ai` 但 single key 不齐：写回 `rule`
- 写回 DB 后再同步内存（或一起在锁中更新）

- [ ] **Step 2: 轻量验证**

```bash
python -m unittest backend/tests/test_default_mode_rule.py backend/tests/test_prediction_mode_gates.py -v
```

Expected: PASS

---

### Task 4: 移除分析时“自动降级写 mode”的路径，改为阻止执行（并更新测试）

**Files:**
- Modify: [analysis.py](file:///workspace/backend/app/services/game/analysis.py)
- Modify: `/workspace/backend/tests/test_ai_analysis_fallbacks.py`

- [ ] **Step 1: 更新测试**

将现有“缺 key 自动降级为 rule”的断言改为：
- 在缺 key 情况下，系统保持当前模式不可被设置为 ai/single_ai（由门禁保证）
- 如仍能触发分析入口，返回结果需明确提示“请配置密钥或切换到规则”

- [ ] **Step 2: 修改实现**

删除/改写：
- `sess.prediction_mode = "rule"` 与 `state.prediction_mode = "rule"` 的自动降级写入
- 改为抛 `HTTPException(400, "...")` 或返回结构化错误（保持现有调用链可用）

- [ ] **Step 3: 跑相关测试**

```bash
python -m unittest backend/tests/test_ai_analysis_fallbacks.py -v
```

Expected: PASS

---

### Task 5: JWT_SECRET_KEY 固化（首次生成写入 backend/.env）

**Files:**
- Modify: [env_migration.py](file:///workspace/backend/app/core/env_migration.py)
- Modify: [main.py](file:///workspace/backend/app/api/main.py)
- Modify: [config.py](file:///workspace/backend/app/core/config.py)

- [ ] **Step 1: env_migration 增加 ensure_env_key**

新增函数：
- `ensure_env_key(env_path: str, key: str, generator: Callable[[], str]) -> bool`
  - 若 `os.environ.get(key)` 已有值：返回 False
  - 否则生成并写入 `backend/.env`，同时设置 `os.environ[key]`
  - 不打印生成值

- [ ] **Step 2: main.py 在 import settings 前调用确保 JWT_SECRET_KEY**

在 `from app.core.config import settings` 之前执行 ensure，确保 settings 初始化时读取到固定值。

- [ ] **Step 3: config.py 调整默认值**

将 `JWT_SECRET_KEY` 的默认生成逻辑移出类属性，改为：
- `JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "")`
并由 main.py 保证其不为空。

---

### Task 6: SQLite 默认路径固定到 backend/data/baccarat.db（优先 DATABASE_URL）

**Files:**
- Modify: [config.py](file:///workspace/backend/app/core/config.py#L27-L35)

- [ ] **Step 1: 改造 DATABASE_URL 默认值为绝对路径**

当 `DATABASE_URL` 未设置时：
- 返回 `sqlite+aiosqlite:///<ABS_BACKEND_DIR>/data/baccarat.db`

- [ ] **Step 2: 跑后端全量测试**

```bash
mkdir -p /workspace/data
python -m unittest discover -s backend/tests -p 'test_*.py' -v
```

Expected: PASS

---

### Task 7: 前端默认显示 rule（避免首屏误导）

**Files:**
- Modify: [AdminPage.tsx](file:///workspace/frontend/src/pages/AdminPage.tsx#L127-L139)

- [ ] **Step 1: predictionMode 初始值改为 'rule'**

```ts
const [predictionMode, setPredictionMode] = useState<'ai' | 'single_ai' | 'rule'>('rule');
```

- [ ] **Step 2: 前端构建**

```bash
cd /workspace/frontend && npm run build
```

Expected: PASS

---

### Task 8: 全量回归 + 静态资源同步 + 重启验证

- [ ] **Step 1: Frontend build + sync static**

```bash
cd /workspace/frontend && npm run build
rm -rf /workspace/backend/static && mkdir -p /workspace/backend/static && cp -r /workspace/frontend/dist/* /workspace/backend/static/
```

- [ ] **Step 2: Restart**

```bash
PYTHONPATH=/workspace/backend python -m uvicorn app.api.main:app --host 0.0.0.0 --port 8001 --log-level warning
```

- [ ] **Step 3: Smoke**

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:8001/
curl -sS http://localhost:8001/api/system/state | python -c "import sys,json; print(json.load(sys.stdin).get('prediction_mode'))"
```

Expected:
- 首页 200
- prediction_mode 输出 `rule`

---

## Plan Self-Review

- 覆盖需求：默认 rule、不可无 key 切换、启动纠偏、JWT 固化、DB 默认路径固定、测试与重启验证步骤齐全。
- 无占位符。

