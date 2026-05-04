# 单AI模式提示词配置（预测 + 等待开奖策略）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让单AI模式支持“预测提示词 + 等待开奖策略提示词”的在线配置，并确保每局必出庄/闲预测、每局自动下注时金额能随置信度/连错/余额更激进地自适应。

**Architecture:** 预测提示词存入数据库 `model_versions.prompt_template`（prediction_mode=`single_ai`，以 active 版本为准）；等待开奖策略提示词以 Base64 存入 `.env` 并通过 settings 动态读取。下注金额在现有 `compute_bet_amount()` 基础上叠加连错衰减（默认 0.6）与余额比例上限。

**Tech Stack:** FastAPI + SQLAlchemy (async) + SQLite, React + antd + react-query, pytest, vitest.

---

## Files to touch

**Backend**
- Modify: [config.py](file:///workspace/backend/app/core/config.py)
- Modify: [env_migration.py](file:///workspace/backend/app/core/env_migration.py)
- Modify: [auth.py](file:///workspace/backend/app/api/routes/auth.py)
- Modify: [schemas.py](file:///workspace/backend/app/api/routes/schemas.py)
- Modify: [bet_sizing.py](file:///workspace/backend/app/services/game/bet_sizing.py)
- Modify: [analysis.py](file:///workspace/backend/app/services/game/analysis.py)
- Modify: [single_model_service.py](file:///workspace/backend/app/services/single_model_service.py)
- Create: `backend/tests/test_single_ai_prompt_templates_api.py`
- Modify: [test_bet_sizing_exponential.py](file:///workspace/backend/tests/test_bet_sizing_exponential.py)

**Frontend**
- Modify: [api.ts](file:///workspace/frontend/src/services/api.ts)
- Modify: [AdminPage.tsx](file:///workspace/frontend/src/pages/AdminPage.tsx)
- (Optional) Create: `frontend/src/components/admin/SingleAiPromptConfigCard.tsx`（如果 AdminPage 已过大）
- (Optional) Create tests: `frontend/src/components/admin/singleAiPromptConfig.test.tsx`

---

### Task 1: 后端配置项与“更猛”的自动下注金额

**Files:**
- Modify: [config.py](file:///workspace/backend/app/core/config.py)
- Modify: [bet_sizing.py](file:///workspace/backend/app/services/game/bet_sizing.py)
- Modify: [analysis.py](file:///workspace/backend/app/services/game/analysis.py)
- Modify: [test_bet_sizing_exponential.py](file:///workspace/backend/tests/test_bet_sizing_exponential.py)

- [ ] **Step 1: 先写/补全测试（连错衰减）**

在 [test_bet_sizing_exponential.py](file:///workspace/backend/tests/test_bet_sizing_exponential.py) 追加用例（保证“更猛”的衰减生效且不会破坏原有单调性）：

```python
def test_bet_amount_decay_with_consecutive_errors(self):
    from app.services.game.bet_sizing import compute_bet_amount

    a0 = compute_bet_amount(0.9, balance=1_000_000, consecutive_errors=0)
    a1 = compute_bet_amount(0.9, balance=1_000_000, consecutive_errors=1)
    a2 = compute_bet_amount(0.9, balance=1_000_000, consecutive_errors=2)
    self.assertGreater(a0, a1)
    self.assertGreater(a1, a2)
```

- [ ] **Step 2: 跑测试确认失败**

Run:
```bash
pytest -q backend/tests/test_bet_sizing_exponential.py
```

Expected: FAIL（`compute_bet_amount()` 暂不支持 `consecutive_errors` 参数）。

- [ ] **Step 3: 在 settings 增加下注参数**

在 [config.py](file:///workspace/backend/app/core/config.py) 的“资金与下注配置”区域新增：

```python
BET_ERROR_DECAY: float = float(os.getenv("BET_ERROR_DECAY", "0.60"))
BET_MAX_BALANCE_RATIO: float = float(os.getenv("BET_MAX_BALANCE_RATIO", "0.20"))
```

- [ ] **Step 4: 修改 compute_bet_amount 支持连错衰减与余额比例上限**

在 [bet_sizing.py](file:///workspace/backend/app/services/game/bet_sizing.py) 将签名改为：

```python
def compute_bet_amount(confidence: float, balance: float, consecutive_errors: int = 0) -> float:
```

并在现有 raw 计算之后、步进取整之前加入衰减与余额上限（保持原先 MIN/MAX/STEP 约束）：

```python
errors = int(consecutive_errors or 0)
if errors < 0:
    errors = 0

decay = float(getattr(settings, "BET_ERROR_DECAY", 0.6) or 0.6)
decay = max(0.05, min(0.95, decay))
raw = raw * (decay ** errors)

ratio = float(getattr(settings, "BET_MAX_BALANCE_RATIO", 0.2) or 0.2)
ratio = max(0.0, min(1.0, ratio))
if bal > 0 and ratio > 0:
    raw = min(raw, bal * ratio)
```

最后保留原本的步进取整：

```python
raw = max(min_bet, min(max_bet, raw))
raw = math.floor(raw / step) * step
if bal > 0:
    raw = min(raw, bal)
return float(raw)
```

- [ ] **Step 5: 分析结果写回时把 consecutive_errors 传给 bet sizing**

在 [analysis.py](file:///workspace/backend/app/services/game/analysis.py) 设置下注金额处改为：

```python
sess.predict_bet_amount = compute_bet_amount(sess.predict_confidence, sess.balance, consecutive_errors=sess.consecutive_errors)
```

- [ ] **Step 6: 跑测试**

Run:
```bash
pytest -q backend/tests/test_bet_sizing_exponential.py
```

Expected: PASS

- [ ] **Step 7: 全量后端测试**

Run:
```bash
pytest -q backend/tests
```

Expected: PASS

---

### Task 2: 单AI“等待开奖策略提示词”配置（.env Base64）

**Files:**
- Modify: [config.py](file:///workspace/backend/app/core/config.py)
- Modify: [env_migration.py](file:///workspace/backend/app/core/env_migration.py)
- Modify: [single_model_service.py](file:///workspace/backend/app/services/single_model_service.py)

- [ ] **Step 1: settings 增加 env 读取（Base64 解码）**

在 [config.py](file:///workspace/backend/app/core/config.py) 的单AI配置附近新增 key，并提供 property：

```python
SINGLE_AI_REALTIME_STRATEGY_PROMPT_B64: str = os.getenv("SINGLE_AI_REALTIME_STRATEGY_PROMPT_B64", "")

@property
def SINGLE_AI_REALTIME_STRATEGY_PROMPT_TEMPLATE(self) -> str:
    import base64
    raw = os.getenv("SINGLE_AI_REALTIME_STRATEGY_PROMPT_B64", "") or ""
    if not raw:
        return ""
    try:
        return base64.urlsafe_b64decode(raw.encode("utf-8")).decode("utf-8")
    except Exception:
        return ""
```

- [ ] **Step 2: env whitelist 增加 key（可选但推荐）**

在 [env_migration.py](file:///workspace/backend/app/core/env_migration.py) 的 `KEY_WHITELIST` 追加：

```python
"SINGLE_AI_REALTIME_STRATEGY_PROMPT_B64",
"BET_ERROR_DECAY",
"BET_MAX_BALANCE_RATIO",
```

- [ ] **Step 3: 单AI等待开奖策略提炼支持模板**

在 [single_model_service.py](file:///workspace/backend/app/services/single_model_service.py) 的 `realtime_strategy_learning()`：
- 如果 `settings.SINGLE_AI_REALTIME_STRATEGY_PROMPT_TEMPLATE` 非空：渲染占位符并调用 `_call_raw`
- 否则使用现有默认提示词

渲染建议用最小字符串替换（避免引入新依赖）：

```python
tmpl = settings.SINGLE_AI_REALTIME_STRATEGY_PROMPT_TEMPLATE
if tmpl:
    encoded_road_data = jsonable_encoder(road_data)
    prompt = (
        tmpl
        .replace("{{GAME_HISTORY}}", json.dumps(game_history, ensure_ascii=False))
        .replace("{{ROAD_DATA}}", json.dumps(encoded_road_data, ensure_ascii=False))
        .replace("{{CONSECUTIVE_ERRORS}}", str(consecutive_errors))
    )
    return await self._call_raw(prompt)
```

---

### Task 3: 单AI预测提示词在线配置（DB: model_versions.prompt_template）

**Files:**
- Modify: [schemas.py](file:///workspace/backend/app/api/routes/schemas.py)
- Modify: [auth.py](file:///workspace/backend/app/api/routes/auth.py)
- Create: `backend/tests/test_single_ai_prompt_templates_api.py`

- [ ] **Step 1: 新增 Pydantic schema**

在 [schemas.py](file:///workspace/backend/app/api/routes/schemas.py) 追加：

```python
class SingleAiPromptTemplatesResponse(BaseModel):
    prediction_mode: str
    active_version: str | None = None
    prediction_template: str | None = None
    realtime_strategy_template: str | None = None

class SingleAiPromptTemplatesUpdateRequest(BaseModel):
    prediction_template: str | None = None
    realtime_strategy_template: str | None = None
```

- [ ] **Step 2: 先写后端接口测试**

创建 `backend/tests/test_single_ai_prompt_templates_api.py`：

```python
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class SingleAiPromptTemplatesApiTest(unittest.TestCase):
    def _ensure_admin_password(self, pwd: str) -> None:
        os.environ["ADMIN_DEFAULT_PASSWORD"] = pwd

    def test_get_and_set_single_ai_templates(self):
        from fastapi.testclient import TestClient
        from app.api.main import app

        self._ensure_admin_password("8888")
        client = TestClient(app)
        token = client.post("/api/admin/login", json={"password": "8888"}).json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        payload = {
            "prediction_template": "PRED {{BOOT_NUMBER}} {{GAME_NUMBER}} {{GAME_HISTORY}}",
            "realtime_strategy_template": "REAL {{CONSECUTIVE_ERRORS}} {{ROAD_DATA}}",
        }
        r = client.post("/api/admin/prompt-templates/single-ai", json=payload, headers=headers)
        self.assertEqual(r.status_code, 200)

        r2 = client.get("/api/admin/prompt-templates/single-ai", headers=headers)
        self.assertEqual(r2.status_code, 200)
        data = r2.json()
        self.assertEqual(data["prediction_mode"], "single_ai")
        self.assertIn("PRED", data.get("prediction_template") or "")
        self.assertIn("REAL", data.get("realtime_strategy_template") or "")
```

- [ ] **Step 3: 跑测试确认失败**

Run:
```bash
pytest -q backend/tests/test_single_ai_prompt_templates_api.py
```

Expected: FAIL（接口未实现）。

- [ ] **Step 4: 在 auth router 实现 GET/POST**

在 [auth.py](file:///workspace/backend/app/api/routes/auth.py)：
- import 新 schema
- 新增两个路由：
  - `GET /api/admin/prompt-templates/single-ai`
  - `POST /api/admin/prompt-templates/single-ai`

关键实现要点（代码片段）：

1) 读取当前 active version：

```python
stmt = select(ModelVersion).where(
    ModelVersion.is_eliminated is False,
    ModelVersion.prediction_mode == "single_ai",
    ModelVersion.is_active == True,
).order_by(desc(ModelVersion.created_at))
```

2) 如不存在 active，则用最新版本；如还不存在，则返回 `prediction_template=None`

3) 写入 prediction_template：
- 若不存在 active 版本：创建一个并 set active
- 若存在：更新其 `prompt_template`
- 同模式下其他版本 `is_active=False`

创建版本号建议：

```python
version_name = f"single_ai-manual-{datetime.now().strftime('%Y%m%d%H%M%S')}"
```

4) 写入 realtime_strategy_template：
- 使用 `base64.urlsafe_b64encode(text.encode("utf-8")).decode("utf-8")`
- 写入 `.env`：复用 `update_api_config()` 里的 `set_env_var()`，写 key `SINGLE_AI_REALTIME_STRATEGY_PROMPT_B64`
- 同步 `os.environ[key] = b64`（确保运行时即时生效）

- [ ] **Step 5: 跑测试**

Run:
```bash
pytest -q backend/tests/test_single_ai_prompt_templates_api.py
```

Expected: PASS

---

### Task 4: 单AI输出强约束（永远只产出庄/闲）

**Files:**
- Modify: [single_model_service.py](file:///workspace/backend/app/services/single_model_service.py)
- Modify: [analysis.py](file:///workspace/backend/app/services/game/analysis.py)
- Modify: `backend/tests/test_single_ai_analysis.py`（如果已有覆盖）

- [ ] **Step 1: 预测 JSON 解析后强制清洗 final_prediction**

在 [single_model_service.py](file:///workspace/backend/app/services/single_model_service.py) 组装 `combined_model` 时，把 `final_prediction` 规范化：

```python
fp = parsed.get("final_prediction") or parsed.get("prediction") or "庄"
if fp not in ("庄", "闲"):
    fp = "庄"
combined_model = { "final_prediction": fp, ... }
```

- [ ] **Step 2: 单AI异常兜底不再返回“观望”**

在 [analysis.py](file:///workspace/backend/app/services/game/analysis.py) 单AI异常分支把：
`"final_prediction": "观望"` 改为 `"庄"`（保持“每局必下”）。

- [ ] **Step 3: 跑后端全量测试**

Run:
```bash
pytest -q backend/tests
```

Expected: PASS

---

### Task 5: 前端管理员页“单AI提示词配置”卡片

**Files:**
- Modify: [api.ts](file:///workspace/frontend/src/services/api.ts)
- Modify: [AdminPage.tsx](file:///workspace/frontend/src/pages/AdminPage.tsx)

- [ ] **Step 1: 前端 API 封装**

在 [api.ts](file:///workspace/frontend/src/services/api.ts) 增加：

```ts
export interface SingleAiPromptTemplates {
  prediction_mode: 'single_ai';
  active_version?: string | null;
  prediction_template?: string | null;
  realtime_strategy_template?: string | null;
}

export const getSingleAiPromptTemplates = async () => {
  return api.get<SingleAiPromptTemplates>('/admin/prompt-templates/single-ai');
};

export const updateSingleAiPromptTemplates = async (payload: {
  prediction_template?: string | null;
  realtime_strategy_template?: string | null;
}) => {
  return api.post<SingleAiPromptTemplates>('/admin/prompt-templates/single-ai', payload);
};
```

- [ ] **Step 2: AdminPage 新增 UI（文本域 + 保存/恢复默认）**

在 [AdminPage.tsx](file:///workspace/frontend/src/pages/AdminPage.tsx) 的“AI大模型与规则引擎”Tab 内新增 Card：
- `Input.TextArea` 两个
- Buttons：保存 / 恢复默认
- 加载时调用 `getSingleAiPromptTemplates()` 填充

交互要点：
- 保存后 toast：提示保存成功，显示 active_version（如有）
- 恢复默认：发送 `null` 清空并回退默认提示词

- [ ] **Step 3: 前端测试与构建**

Run:
```bash
cd frontend
npm run lint
npm test
npm run build
```

Expected: PASS

---

### Task 6: 端到端回归（后端 + 前端）

- [ ] **Step 1: 后端**

Run:
```bash
cd backend
pytest -q
```

- [ ] **Step 2: 前端**

Run:
```bash
cd frontend
npm run lint && npm test && npm run build
```

- [ ] **Step 3: 手动验证（本地）**
- 管理员登录 → 管理页配置单AI提示词 → 保存
- 切到 单AI 模式 → 上传数据/开奖触发分析
- 检查：分析输出仍是庄/闲；下注金额随连错衰减更猛（例如连错 2 次明显缩仓）

---

## Plan Self‑Review (done)

- Spec coverage：已覆盖“预测模板 DB + 等待开奖模板 env + UI 配置入口 + 强制庄/闲 + 更猛下注衰减”
- Placeholder scan：无 TBD/TODO；每个任务给出明确文件/代码/命令
- Type consistency：后端 schema 与前端 types 对齐（`prediction_template`, `realtime_strategy_template`）

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-04-single-ai-prompts-config-plan.md`. Two execution options:

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks
2. **Inline Execution** - Execute tasks in this session using executing-plans with checkpoints

Which approach?

