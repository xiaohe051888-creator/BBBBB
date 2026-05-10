# 单AI解析失败工作流修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复单AI返回不可解析内容时仍被当成“分析完成”的错误工作流，让无效结果只能进入备用判断或失败态。

**Architecture:** 先用后端测试锁住“解析失败不再产出伪成功结果”，再重构单AI解析器与 `run_ai_analysis()` 的验收逻辑；随后调整 follow-up analysis 状态流、日志事件和前端主卡/详情抽屉，只在后端给出有效结果时才展示“已完成判断”。最后跑后端回归、前端回归、构建并推送部署。

**Tech Stack:** Python, FastAPI, aiohttp, pytest/unittest, React, TypeScript, Vitest, Ant Design

---

### Task 1: 锁住单AI解析失败不再伪装成成功结果

**Files:**
- Modify: `backend/tests/test_single_ai_analysis.py`
- Modify: `backend/tests/test_analysis_outcome_contract.py`
- Test: `backend/tests/test_single_ai_analysis.py`

- [ ] **Step 1: 先写失败测试，锁住非 JSON 返回不能再变成默认“庄/0%”**

```python
def test_single_ai_invalid_text_does_not_become_fake_success(self):
    async def _run():
        from app.core import config as config_module
        from app.core.database import async_session, init_db
        from app.models.schemas import GameRecord
        from app.services.game.analysis import run_ai_analysis
        from app.services.game.session import get_session, get_session_lock

        await init_db()
        boot = 998001

        async with async_session() as s:
            for i in range(1, 6):
                s.add(GameRecord(boot_number=boot, game_number=i, result="庄"))
            await s.commit()

        async with get_session_lock():
            sess = get_session()
            sess.boot_number = boot
            sess.next_game_number = 6
            sess.prediction_mode = "single_ai"

        config_module.settings.SINGLE_AI_API_KEY = "x" * 20

        with patch(
            "app.services.single_model_service.SingleModelService._call_model",
            new=AsyncMock(return_value="我觉得这局更偏向庄，但我先解释一下原因"),
        ):
            async with async_session() as s:
                return await run_ai_analysis(s, boot_number=boot)

    result = asyncio.run(_run())

    assert result["success"] is False
    assert result["prediction"] is None
    assert result.get("analysis_outcome") is None
    assert "解析失败" in (result.get("reason") or "")
```

- [ ] **Step 2: 跑测试确认红灯**

Run: `cd /workspace && python -m pytest backend/tests/test_single_ai_analysis.py -q`
Expected: FAIL，因为当前解析失败仍会回落成默认成功结果。

- [ ] **Step 3: 再写一条失败测试，锁住缺字段 JSON 也不能被当成成功**

```python
def test_single_ai_missing_required_fields_is_invalid(self):
    from app.services.single_model_service import parse_single_ai_response

    with self.assertRaisesRegex(Exception, "缺少必须字段"):
        parse_single_ai_response('{"final_prediction":"庄","confidence":0.5}')
```

- [ ] **Step 4: 再跑测试确认红灯**

Run: `cd /workspace && python -m pytest backend/tests/test_single_ai_analysis.py -q`
Expected: FAIL，因为当前还没有严格的结构校验与异常。

- [ ] **Step 5: 提交测试基线**

```bash
git add backend/tests/test_single_ai_analysis.py
git commit -m "test: lock single-ai parse failure against fake success"
```

### Task 2: 重构单AI解析器，只产出有效结果或异常

**Files:**
- Modify: `backend/app/services/single_model_service.py`
- Test: `backend/tests/test_single_ai_analysis.py`

- [ ] **Step 1: 增加明确异常类型与解析入口**

```python
class SingleAIParseError(Exception):
    pass


def parse_single_ai_response(raw_text: str) -> dict:
    text = (raw_text or "").strip()
    if not text:
        raise SingleAIParseError("解析失败：模型没有返回内容")
    ...
```

- [ ] **Step 2: 严格校验最小有效字段**

```python
required_fields = ["final_prediction", "confidence", "summary", "reasoning_detail"]
missing = [field for field in required_fields if not data.get(field)]
if missing:
    raise SingleAIParseError(f"解析失败：缺少必须字段 {', '.join(missing)}")

prediction = str(data.get("final_prediction", "")).strip()
if prediction not in ("庄", "闲"):
    raise SingleAIParseError("解析失败：预测方向无效")

confidence = float(data.get("confidence"))
if confidence < 0 or confidence > 1:
    raise SingleAIParseError("解析失败：把握程度超出范围")
```

- [ ] **Step 3: 替换旧的默认返回逻辑**

```python
result = parse_single_ai_response(raw_result)
prediction = result["final_prediction"]
confidence = result["confidence"]
summary = result["summary"]
```

- [ ] **Step 4: 跑测试确认转绿**

Run: `cd /workspace && python -m pytest backend/tests/test_single_ai_analysis.py -q`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add backend/app/services/single_model_service.py backend/tests/test_single_ai_analysis.py
git commit -m "refactor: make single-ai parsing strict"
```

### Task 3: 重构单AI分析工作流，只在有效结果下写入成功态

**Files:**
- Modify: `backend/app/services/game/analysis.py`
- Modify: `backend/tests/test_analysis_outcome_contract.py`
- Modify: `backend/tests/test_game_analysis_trigger_flow.py`
- Test: `backend/tests/test_analysis_outcome_contract.py`

- [ ] **Step 1: 先写失败测试，锁住单AI解析失败时不产出 `analysis_outcome`**

```python
def test_run_ai_analysis_single_ai_invalid_result_returns_failure():
    async def _run():
        from app.core import config as config_module
        from app.core.database import async_session, init_db
        from app.models.schemas import GameRecord
        from app.services.game.analysis import run_ai_analysis
        from app.services.game.session import get_session, get_session_lock

        await init_db()
        boot = 998101

        async with async_session() as s:
            for i in range(1, 6):
                s.add(GameRecord(boot_number=boot, game_number=i, result="闲"))
            await s.commit()

        async with get_session_lock():
            sess = get_session()
            sess.boot_number = boot
            sess.next_game_number = 6
            sess.prediction_mode = "single_ai"

        config_module.settings.SINGLE_AI_API_KEY = "x" * 20
        with patch(
            "app.services.single_model_service.SingleModelService._call_model",
            new=AsyncMock(return_value='{"final_prediction":"庄"}'),
        ):
            async with async_session() as s:
                return await run_ai_analysis(s, boot_number=boot)

    result = asyncio.run(_run())

    assert result["success"] is False
    assert result.get("analysis_outcome") is None
    assert result.get("prediction") is None
```

- [ ] **Step 2: 跑测试确认红灯**

Run: `cd /workspace && python -m pytest backend/tests/test_analysis_outcome_contract.py -q`
Expected: FAIL，因为当前无效结果仍会进入成功路径。

- [ ] **Step 3: 在 `run_ai_analysis()` 中增加验收分支**

```python
try:
    ai_res = await svc.analyze(...)
except SingleAIParseError as exc:
    return {
        "success": False,
        "prediction": None,
        "confidence": None,
        "reason": str(exc),
        "analysis_outcome": None,
        "error_type": "single_ai_parse_failure",
    }
```

- [ ] **Step 4: 只有在 `success=True` 且 `analysis_outcome` 存在时才写入成功态**

```python
if not res.get("success") or not res.get("analysis_outcome"):
    sess.analysis_outcome = None
    sess.predict_direction = None
    sess.predict_confidence = None
    ...
    return res
```

- [ ] **Step 5: 跑测试确认转绿**

Run: `cd /workspace && python -m pytest backend/tests/test_analysis_outcome_contract.py -q`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add backend/app/services/game/analysis.py backend/tests/test_analysis_outcome_contract.py backend/tests/test_single_ai_analysis.py
git commit -m "fix: reject invalid single-ai outcomes"
```

### Task 4: 修复 follow-up analysis、下注流和日志事件

**Files:**
- Modify: `backend/app/api/routes/game.py`
- Modify: `backend/tests/test_game_analysis_trigger_flow.py`
- Modify: `backend/tests/test_history_backfill.py`
- Test: `backend/tests/test_game_analysis_trigger_flow.py`

- [ ] **Step 1: 先写失败测试，锁住解析失败后应进入备用判断，而不是记成功日志**

```python
def test_followup_analysis_parse_failure_uses_rule_fallback_not_success_log(self):
    async def _run():
        ...
        with patch("app.services.game.run_ai_analysis", new=AsyncMock(return_value={
            "success": False,
            "prediction": None,
            "confidence": None,
            "reason": "解析失败：缺少必须字段 summary",
            "analysis_outcome": None,
            "error_type": "single_ai_parse_failure",
        })):
            await _run_followup_analysis(1, "单AI正式分析失败")
            ...
            return {
                "status": mem.status,
                "pending_bet": mem.pending_bet_direction,
                "analysis_source": (mem.analysis_outcome or {}).get("source") if mem.analysis_outcome else None,
            }

    result = asyncio.run(_run())
    self.assertEqual(result["status"], "等待开奖")
    self.assertIn(result["pending_bet"], ("庄", "闲"))
    self.assertEqual(result["analysis_source"], "rule_fallback")
```

- [ ] **Step 2: 跑测试确认红灯**

Run: `cd /workspace && python -m pytest backend/tests/test_game_analysis_trigger_flow.py -q`
Expected: FAIL，因为当前无效结果可能已先写成功态或成功日志。

- [ ] **Step 3: 在 follow-up analysis 中按 `analysis_outcome` 是否有效决定流转**

```python
if not analysis_result.get("success") or not analysis_result.get("analysis_outcome"):
    await _run_single_ai_rule_fallback(...)
    return
```

- [ ] **Step 4: 避免为解析失败的单AI结果写成功完成日志**

```python
if analysis_result.get("success") and analysis_result.get("analysis_outcome"):
    await add_log(..., event_code="LOG-MDL-001", ...)
```

- [ ] **Step 5: 跑测试确认转绿**

Run: `cd /workspace && python -m pytest backend/tests/test_game_analysis_trigger_flow.py -q`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add backend/app/api/routes/game.py backend/tests/test_game_analysis_trigger_flow.py
git commit -m "fix: route single-ai parse failures to fallback flow"
```

### Task 5: 收口前端主卡与详情页，只展示真实有效结果

**Files:**
- Modify: `frontend/src/components/dashboard/AnalysisPanel.tsx`
- Modify: `frontend/src/components/dashboard/AnalysisDetailDrawer.tsx`
- Modify: `frontend/src/components/dashboard/AnalysisPanel.test.tsx`
- Modify: `frontend/src/components/dashboard/AnalysisDetailDrawer.test.tsx`
- Test: `frontend/src/components/dashboard/AnalysisPanel.test.tsx`
- Test: `frontend/src/components/dashboard/AnalysisDetailDrawer.test.tsx`

- [ ] **Step 1: 写失败测试，锁住“解析失败”不能再显示建议方向与已完成判断**

```tsx
it('does not render a completed recommendation card for invalid analysis content', async () => {
  ...
  root.render(
    <AnalysisPanel
      hasGameData
      hasPendingBet={false}
      aiAnalyzing={false}
      workflowStage={{ type: 'analyzed_pending_bet', showAnalysisLoading: false, showCompletedAnalysis: true }}
      analysis={{
        prediction: null,
        confidence: 0,
        combined_summary: '解析失败',
        prediction_mode: 'single_ai',
        analysis_outcome: null,
      }}
    />
  )
  const html = container.innerHTML
  expect(html).not.toContain('已完成判断')
  expect(html).not.toContain('本局建议')
  expect(html).toContain('系统正在整理本局数据')
})
```

- [ ] **Step 2: 写失败测试，锁住详情页不再把“解析失败”作为成功理由展示**

```tsx
it('does not show parse failure as a successful recommendation reason', async () => {
  ...
  expect(html).not.toContain('本局建议：庄')
  expect(html).not.toContain('解析失败')
})
```

- [ ] **Step 3: 跑前端测试确认红灯**

Run:

```bash
cd /workspace/frontend
npm test -- src/components/dashboard/AnalysisPanel.test.tsx src/components/dashboard/AnalysisDetailDrawer.test.tsx
```

Expected: FAIL，因为当前主卡会按旧逻辑兜底拼成功态。

- [ ] **Step 4: 在 `AnalysisPanel` 中移除错误数据兜底成功态**

```tsx
const outcome = analysis?.analysis_outcome ?? null
const hasValidOutcome = !!outcome?.direction && typeof outcome?.confidence === 'number' && !!outcome?.short_reason

if (!hasValidOutcome) {
  return <PreparingCard />
}
```

- [ ] **Step 5: 在详情入口上只允许有效结果打开详情**

```tsx
{hasValidOutcome ? (
  <AnalysisDetailDrawer ... outcome={outcome} />
) : null}
```

- [ ] **Step 6: 跑前端测试确认转绿**

Run:

```bash
cd /workspace/frontend
npm test -- src/components/dashboard/AnalysisPanel.test.tsx src/components/dashboard/AnalysisDetailDrawer.test.tsx
```

Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add frontend/src/components/dashboard/AnalysisPanel.tsx frontend/src/components/dashboard/AnalysisDetailDrawer.tsx frontend/src/components/dashboard/AnalysisPanel.test.tsx frontend/src/components/dashboard/AnalysisDetailDrawer.test.tsx
git commit -m "fix: hide fake completed analysis states"
```

### Task 6: 提升默认提示词与诊断可读性

**Files:**
- Modify: `backend/app/services/single_model_service.py`
- Modify: `frontend/src/utils/i18nErrors.ts`
- Modify: `frontend/src/utils/logHumanizer.ts`
- Test: `backend/tests/test_single_ai_analysis.py`
- Test: `frontend/src/utils/i18nErrors.test.ts`

- [ ] **Step 1: 写失败测试，锁住解析失败诊断要明确区分“无有效结果”**

```python
def test_parse_failure_reason_is_specific_for_invalid_single_ai_output(self):
    from app.services.single_model_service import SingleAIParseError

    err = SingleAIParseError("解析失败：缺少必须字段 summary")
    self.assertIn("缺少必须字段", str(err))
```

- [ ] **Step 2: 重构默认提示词，继续强化只输出 JSON**

```python
"你可以先内部思考，但最终回复只能是严格 JSON。"
"禁止输出 Markdown、代码块、前置说明、后置说明。"
"如果无法判断，也必须按 JSON 字段给出最接近的结构化结果。"
```

- [ ] **Step 3: 收口前端中文诊断**

```ts
if (lower.includes('缺少必须字段')) {
  return '这次智能判断返回的内容不完整，系统没有把它当成有效结果，随后会自动改用备用判断。';
}
if (lower.includes('预测方向无效')) {
  return '这次智能判断返回了无法识别的方向内容，系统没有采用该结果。';
}
```

- [ ] **Step 4: 跑相关测试确认通过**

Run:

```bash
cd /workspace
python -m pytest backend/tests/test_single_ai_analysis.py -q
cd /workspace/frontend
npm test -- src/utils/i18nErrors.test.ts src/utils/logHumanizer.test.ts
```

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add backend/app/services/single_model_service.py frontend/src/utils/i18nErrors.ts frontend/src/utils/logHumanizer.ts backend/tests/test_single_ai_analysis.py frontend/src/utils/i18nErrors.test.ts
git commit -m "refactor: clarify single-ai parse failure diagnostics"
```

### Task 7: 全量回归、构建、推送与部署核验

**Files:**
- Modify: `backend/tests/test_single_ai_analysis.py`
- Modify: `backend/tests/test_analysis_outcome_contract.py`
- Modify: `backend/tests/test_game_analysis_trigger_flow.py`
- Modify: `frontend/src/components/dashboard/AnalysisPanel.test.tsx`
- Modify: `frontend/src/components/dashboard/AnalysisDetailDrawer.test.tsx`

- [ ] **Step 1: 跑后端关键回归**

Run:

```bash
cd /workspace
python -m pytest \
  backend/tests/test_single_ai_analysis.py \
  backend/tests/test_analysis_outcome_contract.py \
  backend/tests/test_game_analysis_trigger_flow.py \
  backend/tests/test_api_config_and_prediction_mode_flow.py -q
```

Expected: PASS

- [ ] **Step 2: 跑前端关键回归**

Run:

```bash
cd /workspace/frontend
npm test -- \
  src/components/dashboard/AnalysisPanel.test.tsx \
  src/components/dashboard/AnalysisDetailDrawer.test.tsx \
  src/utils/i18nErrors.test.ts \
  src/utils/logHumanizer.test.ts
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
git commit -m "fix: repair single-ai parse failure workflow"
```

- [ ] **Step 5: 推送远端**

```bash
git push origin main
```

- [ ] **Step 6: 核对部署**

Run:

```bash
cd /workspace
python - <<'PY'
import re, urllib.request
base='https://bbbbb-frontend.onrender.com'
html=urllib.request.urlopen(base, timeout=60).read().decode('utf-8','ignore')
print(re.search(r'/assets/index-([^"\']+)\\.js', html).group(0))
PY
```

Expected: 前端资源切到新包；必要时继续轮询直到命中新文案或新逻辑标识。
