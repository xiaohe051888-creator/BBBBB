# DeepSeek V4 Pro 单AI正式调用修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 DeepSeek `V4 Pro + thinking=enabled` 在单AI模式下“测试可用但正式分析预测失败/超时”的问题，并让配置页固定到该运行模型。

**Architecture:** 先用测试锁住测试链路与正式链路不一致、单AI模型可跑偏、超时预算失配这三类问题，再抽出统一的 DeepSeek 地址与请求配置构造逻辑，让测试与正式分析共用；最后收口管理页表单、提示词模板与诊断信息，完成回归验证。

**Tech Stack:** Python, FastAPI, aiohttp, httpx, pytest/unittest, React, TypeScript, Ant Design, Vitest

---

### Task 1: 锁住 DeepSeek 单AI运行约束

**Files:**
- Modify: `backend/tests/test_api_config_and_prediction_mode_flow.py`
- Modify: `backend/tests/test_ai_config_base_url_normalization.py`
- Test: `backend/tests/test_api_config_and_prediction_mode_flow.py`

- [ ] **Step 1: 写失败测试，锁住单AI必须固定为 DeepSeek V4 Pro**

```python
def test_saving_single_ai_config_forces_deepseek_v4_pro(self):
    api_key = "sk-force-1234567890"
    with TestClient(app) as client:
        headers = self._login_headers(client)
        res = client.post(
            "/api/admin/api-config",
            json={
                "role": "single",
                "provider": "deepseek",
                "model": "deepseek-chat",
                "api_key": api_key,
                "base_url": "https://api.deepseek.com",
            },
            headers=headers,
        )
        self.assertEqual(res.status_code, 200)

        async def _check():
            async with async_session() as session:
                row = await session.get(AiModelConfig, "single")
                return row.provider, row.model, row.base_url

        provider, model, base_url = self._run_async(_check())
        self.assertEqual(provider, "deepseek")
        self.assertEqual(model, "deepseek-v4-pro")
        self.assertEqual(base_url, "https://api.deepseek.com")
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /workspace && python -m pytest backend/tests/test_api_config_and_prediction_mode_flow.py -q`
Expected: FAIL，因为当前单AI仍会保存传入的任意模型值。

- [ ] **Step 3: 最小实现，收口单AI保存逻辑**

```python
if req.role == "single":
    req.provider = "deepseek"
    req.model = "deepseek-v4-pro"
    req.base_url = normalize_base_url("deepseek", req.base_url) or "https://api.deepseek.com"
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd /workspace && python -m pytest backend/tests/test_api_config_and_prediction_mode_flow.py -q`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add backend/tests/test_api_config_and_prediction_mode_flow.py backend/app/api/routes/auth.py
git commit -m "test: lock single-ai to deepseek v4 pro"
```

### Task 2: 抽出统一的 DeepSeek 地址构造器

**Files:**
- Create: `backend/app/services/single_ai_runtime.py`
- Modify: `backend/app/api/routes/auth.py`
- Modify: `backend/app/services/single_model_service.py`
- Test: `backend/tests/test_ai_config_base_url_normalization.py`

- [ ] **Step 1: 先写失败测试，锁住测试接口与正式接口使用同一地址规则**

```python
def test_single_ai_runtime_url_uses_same_normalization_as_api_test():
    from app.services.single_ai_runtime import build_single_ai_runtime_config

    cfg = build_single_ai_runtime_config(
        provider="deepseek",
        model="deepseek-v4-pro",
        base_url="https://api.deepseek.com",
        api_key="sk-test",
    )

    assert cfg["normalized_base_url"] == "https://api.deepseek.com"
    assert cfg["chat_completions_url"] == "https://api.deepseek.com/chat/completions"
    assert cfg["model"] == "deepseek-v4-pro"
    assert cfg["thinking"] == {"type": "enabled"}
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /workspace && python -m pytest backend/tests/test_ai_config_base_url_normalization.py -q`
Expected: FAIL，因为统一构造器尚不存在。

- [ ] **Step 3: 写最小实现**

```python
from app.services.ai_config_status import normalize_base_url

def build_single_ai_runtime_config(provider: str, model: str, base_url: str | None, api_key: str):
    normalized = normalize_base_url(provider, base_url) or "https://api.deepseek.com"
    return {
        "provider": "deepseek",
        "model": "deepseek-v4-pro",
        "normalized_base_url": normalized.rstrip("/"),
        "chat_completions_url": f"{normalized.rstrip('/')}/chat/completions",
        "api_key": api_key,
        "thinking": {"type": "enabled"},
    }
```

- [ ] **Step 4: 让测试接口和正式调用共用该构造器**

```python
runtime_cfg = build_single_ai_runtime_config(
    provider="deepseek",
    model=settings.SINGLE_AI_MODEL,
    base_url=settings.SINGLE_AI_API_BASE,
    api_key=settings.SINGLE_AI_API_KEY,
)
url = runtime_cfg["chat_completions_url"]
payload["model"] = runtime_cfg["model"]
payload["thinking"] = runtime_cfg["thinking"]
```

- [ ] **Step 5: 跑测试确认通过**

Run: `cd /workspace && python -m pytest backend/tests/test_ai_config_base_url_normalization.py -q`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add backend/app/services/single_ai_runtime.py backend/app/api/routes/auth.py backend/app/services/single_model_service.py backend/tests/test_ai_config_base_url_normalization.py
git commit -m "refactor: unify deepseek single-ai runtime config"
```

### Task 3: 重做正式分析超时与重试预算

**Files:**
- Modify: `backend/app/core/config.py`
- Modify: `backend/app/services/single_model_service.py`
- Modify: `backend/app/api/routes/game.py`
- Test: `backend/tests/test_game_analysis_trigger_flow.py`

- [ ] **Step 1: 写失败测试，锁住单AI模式的总超时预算大于正式请求预算**

```python
def test_single_ai_followup_timeout_budget_exceeds_request_budget():
    from app.api.routes.game import _followup_analysis_timeout_seconds
    from app.core.config import settings

    settings.SINGLE_AI_REQUEST_TIMEOUT_SECONDS = 75
    settings.SINGLE_AI_MAX_RETRIES = 2
    settings.ANALYSIS_TASK_TIMEOUT_SECONDS = 45

    timeout = _followup_analysis_timeout_seconds(prediction_mode="single_ai")
    assert timeout >= 95
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /workspace && python -m pytest backend/tests/test_game_analysis_trigger_flow.py -q`
Expected: FAIL，因为当前 `_followup_analysis_timeout_seconds()` 不区分单AI模式。

- [ ] **Step 3: 最小实现**

```python
def _followup_analysis_timeout_seconds(prediction_mode: str | None = None) -> float:
    if prediction_mode == "single_ai":
        request_budget = float(getattr(settings, "SINGLE_AI_REQUEST_TIMEOUT_SECONDS", 75) or 75)
        retries = int(getattr(settings, "SINGLE_AI_MAX_RETRIES", 2) or 2)
        return max(float(getattr(settings, "SINGLE_AI_TOTAL_TIMEOUT_SECONDS", 0) or 0), request_budget + max(retries - 1, 0) * 10 + 20)
    configured = float(getattr(settings, "ANALYSIS_TASK_TIMEOUT_SECONDS", 0) or 0)
    if configured > 0:
        return configured
    return float(max(settings.MODEL_TIMEOUT + 15, 45))
```

- [ ] **Step 4: 同步单AI正式请求的 aiohttp 超时与重试数**

```python
timeout = aiohttp.ClientTimeout(total=float(getattr(settings, "SINGLE_AI_REQUEST_TIMEOUT_SECONDS", 75) or 75))
max_retries = int(getattr(settings, "SINGLE_AI_MAX_RETRIES", 2) or 2)
for attempt in range(max_retries):
    ...
```

- [ ] **Step 5: 跑测试确认通过**

Run: `cd /workspace && python -m pytest backend/tests/test_game_analysis_trigger_flow.py -q`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add backend/app/core/config.py backend/app/services/single_model_service.py backend/app/api/routes/game.py backend/tests/test_game_analysis_trigger_flow.py
git commit -m "fix: align deepseek single-ai timeout budgets"
```

### Task 4: 升级单AI测试为正式结构模拟

**Files:**
- Modify: `backend/app/api/routes/auth.py`
- Modify: `backend/tests/test_api_config_and_prediction_mode_flow.py`
- Test: `backend/tests/test_api_config_and_prediction_mode_flow.py`

- [ ] **Step 1: 写失败测试，锁住单AI测试需要走正式结构模拟**

```python
def test_single_ai_api_test_uses_formal_prediction_shape(self):
    from app.api.routes.auth import build_single_ai_test_payload

    payload = build_single_ai_test_payload()
    content = payload["messages"][0]["content"]
    self.assertIn("输出必须是严格 JSON", content)
    self.assertIn("final_prediction", content)
    self.assertEqual(payload["model"], "deepseek-v4-pro")
    self.assertEqual(payload["thinking"], {"type": "enabled"})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /workspace && python -m pytest backend/tests/test_api_config_and_prediction_mode_flow.py -q`
Expected: FAIL，因为当前测试接口仍使用 `"Hello"` 探活。

- [ ] **Step 3: 最小实现**

```python
def build_single_ai_test_payload() -> dict:
    return {
        "model": "deepseek-v4-pro",
        "messages": [{
            "role": "user",
            "content": (
                "你是百家乐分析预测引擎。请基于简化样本预测下一局庄/闲。"
                "输出必须是严格 JSON（不要任何额外文字）。"
                '{"final_prediction":"庄或闲","confidence":0-1,"bet_tier":"保守/标准/激进","summary":"一句话摘要","reasoning_points":["要点1"],"reasoning_detail":"详细推理"}'
            ),
        }],
        "max_tokens": 300,
        "temperature": 0.2,
        "thinking": {"type": "enabled"},
    }
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd /workspace && python -m pytest backend/tests/test_api_config_and_prediction_mode_flow.py -q`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add backend/app/api/routes/auth.py backend/tests/test_api_config_and_prediction_mode_flow.py
git commit -m "feat: make single-ai api test mimic formal prediction"
```

### Task 5: 重构单AI默认提示词与诊断信息

**Files:**
- Modify: `backend/app/services/single_model_service.py`
- Modify: `backend/tests/test_single_ai_analysis.py`
- Modify: `frontend/src/pages/AdminPage.tsx`
- Test: `backend/tests/test_single_ai_analysis.py`

- [ ] **Step 1: 写失败测试，锁住正式提示词约束与诊断字段**

```python
def test_single_ai_runtime_diagnostic_contains_runtime_metadata(self):
    svc = SingleModelService()
    text = svc._build_prompt(
        game_number=8,
        boot_number=1,
        game_history=[{"game_number": 1, "result": "庄"}],
        road_data={"big_road": []},
        mistake_context=[],
        consecutive_errors=0,
        road_features={"pattern": "单跳"},
    )
    self.assertIn("不要输出 Markdown", text)
    self.assertIn("只输出 JSON", text)
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /workspace && python -m pytest backend/tests/test_single_ai_analysis.py -q`
Expected: FAIL，因为当前默认提示词仍较宽松。

- [ ] **Step 3: 最小实现，重构默认预测提示词**

```python
return (
    "你是百家乐单AI预测引擎，使用 DeepSeek V4 Pro 深度思考后完成判断。"
    "你可以先内部思考，但最终只输出严格 JSON。"
    "不要输出 Markdown，不要输出代码块，不要补充解释。"
    '{"final_prediction":"庄或闲","confidence":0-1,"bet_tier":"保守/标准/激进","summary":"一句话摘要","reasoning_points":["要点1","要点2"],"reasoning_detail":"详细推理"}'
    ...
)
```

- [ ] **Step 4: 补充运行诊断**

```python
technical_diagnostic = {
    "code": None,
    "message": str(technical_message).strip(),
    "provider": "deepseek",
    "model": "deepseek-v4-pro",
    "thinking_enabled": True,
    "base_url": runtime_cfg["normalized_base_url"],
}
```

- [ ] **Step 5: 前端单AI模板说明同步为 DeepSeek V4 Pro**

```tsx
<Alert
  type="info"
  showIcon
  message="当前单AI模式固定使用 DeepSeek V4 Pro，并固定开启深度思考。"
/>
```

- [ ] **Step 6: 跑测试确认通过**

Run: `cd /workspace && python -m pytest backend/tests/test_single_ai_analysis.py -q`
Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add backend/app/services/single_model_service.py backend/tests/test_single_ai_analysis.py frontend/src/pages/AdminPage.tsx
git commit -m "refactor: harden deepseek single-ai prompt and diagnostics"
```

### Task 6: 全量回归与构建

**Files:**
- Modify: `backend/tests/test_game_analysis_trigger_flow.py`
- Modify: `backend/tests/test_api_config_and_prediction_mode_flow.py`
- Modify: `backend/tests/test_single_ai_analysis.py`
- Modify: `frontend/src/pages/AdminPage.tsx`

- [ ] **Step 1: 跑后端相关测试**

Run:

```bash
cd /workspace
python -m pytest \
  backend/tests/test_ai_config_base_url_normalization.py \
  backend/tests/test_api_config_and_prediction_mode_flow.py \
  backend/tests/test_single_ai_analysis.py \
  backend/tests/test_game_analysis_trigger_flow.py -q
```

Expected: PASS

- [ ] **Step 2: 跑前端相关测试**

Run:

```bash
cd /workspace/frontend
npm test -- src/pages/ModeSelectPage.test.tsx src/components/dashboard/AnalysisPanel.test.tsx
```

Expected: PASS

- [ ] **Step 3: 跑前端构建**

Run:

```bash
cd /workspace/frontend
npm run build
```

Expected: build success

- [ ] **Step 4: 提交收尾**

```bash
git add backend frontend
git commit -m "fix: stabilize deepseek v4 pro single-ai runtime"
```
