# Analysis UI And Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把首页智能分析改成极简结果卡，把详情页改成小白可读的五路解释页，并在单AI失败时自动走规则兜底继续下注，保证每一局都下注。

**Architecture:** 后端先统一产出 `AnalysisOutcome` 结构，不管来源是 `single_ai` 还是 `rule_fallback`，前端都只消费这一种结果。前端用同一套极简结果卡 + 分段详情页渲染，技术错误只保留在折叠诊断区，用户主视图只看人话结论。

**Tech Stack:** FastAPI, Python, aiohttp, React, TypeScript, Vitest, React Query, WebSocket

---

## File Map

- Modify: `backend/app/models/schemas.py`
  - 扩展分析结果 schema，增加统一 `AnalysisOutcome` 和五路解释结构
- Modify: `backend/app/services/game/analysis.py`
  - 统一单AI成功结果、规则兜底结果和对外返回结构
- Modify: `backend/app/services/game/rule_engine.py`
  - 让规则引擎输出五路逐条解释、人话结论和最终方向原因
- Modify: `backend/app/services/single_model_service.py`
  - 让单AI结果在成功和失败两条分支都能映射到统一 outcome
- Modify: `backend/app/api/routes/game.py`
  - 在 `_run_followup_analysis()` 中实现单AI失败后自动切规则兜底并继续下注
- Modify: `backend/tests/test_game_analysis_trigger_flow.py`
  - 锁住“单AI失败也继续下注”的核心链路
- Create: `backend/tests/test_analysis_outcome_contract.py`
  - 锁住 outcome 契约、五路解释和来源字段
- Modify: `frontend/src/types/models.ts`
  - 定义前端消费的 `AnalysisOutcome` 类型
- Modify: `frontend/src/hooks/useQueries.ts`
  - 保证 `analysis/latest` 查询和 optimistic update 能消费统一 outcome
- Modify: `frontend/src/components/dashboard/AnalysisPanel.tsx`
  - 改成极简结果卡
- Create: `frontend/src/components/dashboard/AnalysisDetailDrawer.tsx`
  - 重做为结构化详情页
- Modify: `frontend/src/components/dashboard/AnalysisPanel.test.tsx`
  - 锁住首页成功态、规则兜底态、等待开奖态
- Create: `frontend/src/components/dashboard/AnalysisDetailDrawer.test.tsx`
  - 锁住详情页五路解释、最终原因、折叠诊断区

---

### Task 1: 定义统一 AnalysisOutcome 契约

**Files:**
- Modify: `backend/app/models/schemas.py`
- Create: `backend/tests/test_analysis_outcome_contract.py`

- [ ] **Step 1: 写失败测试，锁住统一 outcome 结构**

```python
from app.models.schemas import AnalysisOutcome, RoadExplanation


def test_analysis_outcome_contains_user_facing_fields():
    outcome = AnalysisOutcome(
        direction="庄",
        confidence=0.76,
        confidence_label="中",
        source="single_ai",
        short_reason="当前大路延续更明显，本局建议继续跟庄。",
        final_reason="五条路里三条支持庄，两条偏中性，所以最终偏向庄。",
        road_explanations={
            "big_road": RoadExplanation(
                trend_label="大路连庄",
                tendency="庄",
                support_level="强",
                plain_summary="大路连续走庄，说明主走势还没有明显转向。",
            ),
            "bead_road": RoadExplanation(
                trend_label="珠盘路庄多",
                tendency="庄",
                support_level="中",
                plain_summary="珠盘路最近庄更多，整体仍偏庄。",
            ),
            "big_eye_road": RoadExplanation(
                trend_label="大眼仔偏顺",
                tendency="庄",
                support_level="中",
                plain_summary="大眼仔路保持红色顺势，说明当前延续性还在。",
            ),
            "small_road": RoadExplanation(
                trend_label="小路中性",
                tendency="中性",
                support_level="弱",
                plain_summary="小路没有明显新方向，更多是中性提醒。",
            ),
            "cockroach_road": RoadExplanation(
                trend_label="螳螂路轻微支持庄",
                tendency="庄",
                support_level="弱",
                plain_summary="螳螂路暂时没有看到明显反转，更偏向继续跟庄。",
            ),
        },
    )

    assert outcome.source == "single_ai"
    assert outcome.road_explanations["big_road"].plain_summary.startswith("大路")
```

- [ ] **Step 2: 运行测试，确认红灯**

Run: `python -m pytest backend/tests/test_analysis_outcome_contract.py -q`

Expected: FAIL，提示 `AnalysisOutcome` 或 `RoadExplanation` 尚未定义，或缺少字段。

- [ ] **Step 3: 在 schema 中实现最小类型**

```python
class RoadExplanation(BaseModel):
    trend_label: str
    tendency: Literal["庄", "闲", "中性"]
    support_level: Literal["强", "中", "弱"]
    plain_summary: str


class AnalysisOutcome(BaseModel):
    direction: Literal["庄", "闲"]
    confidence: float
    confidence_label: Literal["高", "中", "低"]
    source: Literal["single_ai", "rule_fallback"]
    short_reason: str
    final_reason: str
    fallback_reason: str | None = None
    road_explanations: dict[str, RoadExplanation]
    technical_diagnostic: dict[str, str | None] | None = None
```

- [ ] **Step 4: 运行测试，确认绿灯**

Run: `python -m pytest backend/tests/test_analysis_outcome_contract.py -q`

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add backend/app/models/schemas.py backend/tests/test_analysis_outcome_contract.py
git commit -m "feat(backend): add analysis outcome contract"
```

---

### Task 2: 让规则引擎和单AI都产出统一结果

**Files:**
- Modify: `backend/app/services/game/rule_engine.py`
- Modify: `backend/app/services/single_model_service.py`
- Modify: `backend/app/services/game/analysis.py`
- Test: `backend/tests/test_analysis_outcome_contract.py`

- [ ] **Step 1: 先写失败测试，锁住规则兜底必须产出五路解释**

```python
from app.services.game.rule_engine import BaccaratRuleEngine


def test_rule_engine_builds_user_friendly_road_explanations():
    engine = BaccaratRuleEngine()
    result = engine.analyze(
        game_history=[{"result": "庄"}, {"result": "庄"}, {"result": "庄"}],
        road_data={
            "big_road": [{"value": "庄"}, {"value": "庄"}, {"value": "庄"}],
            "bead_road": [{"value": "庄"}] * 12,
            "big_eye": [{"value": "红"}],
            "small_road": [{"value": "红"}],
            "cockroach_road": [{"value": "蓝"}],
        },
    )

    assert "road_explanations" in result
    assert "final_reason" in result
    assert result["road_explanations"]["big_road"]["plain_summary"]
```

- [ ] **Step 2: 运行测试，确认红灯**

Run: `python -m pytest backend/tests/test_analysis_outcome_contract.py -q`

Expected: FAIL，提示 `road_explanations` 或 `final_reason` 缺失。

- [ ] **Step 3: 最小实现规则兜底的人话结果**

```python
road_explanations = {
    "big_road": {
        "trend_label": big_road_label,
        "tendency": big_road_tendency,
        "support_level": big_road_support,
        "plain_summary": big_road_summary,
    },
    "bead_road": {...},
    "big_eye_road": {...},
    "small_road": {...},
    "cockroach_road": {...},
}

return {
    "predict": prediction,
    "confidence": round(confidence / 100.0, 2),
    "tier": tier,
    "source": "rule_fallback",
    "short_reason": short_reason,
    "final_reason": final_reason,
    "fallback_reason": "本局单AI没有返回稳定结果，系统改用规则判断继续下注。",
    "road_explanations": road_explanations,
    "technical_diagnostic": None,
}
```

- [ ] **Step 4: 给单AI结果补统一映射**

```python
return {
    "prediction": parsed_direction,
    "confidence": confidence,
    "prediction_mode": "single_ai",
    "analysis_outcome": {
        "direction": parsed_direction,
        "confidence": confidence,
        "confidence_label": confidence_label,
        "source": "single_ai",
        "short_reason": short_reason,
        "final_reason": final_reason,
        "road_explanations": road_explanations,
        "technical_diagnostic": diagnostic,
    },
}
```

- [ ] **Step 5: 在聚合层统一返回 `analysis_outcome`**

```python
if prediction_mode == "single_ai":
    return single_ai_result["analysis_outcome"]

rule_result = rule_engine.analyze(game_history, road_data)
return normalize_rule_result_to_outcome(rule_result)
```

- [ ] **Step 6: 运行测试，确认绿灯**

Run: `python -m pytest backend/tests/test_analysis_outcome_contract.py -q`

Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add backend/app/services/game/rule_engine.py backend/app/services/single_model_service.py backend/app/services/game/analysis.py backend/tests/test_analysis_outcome_contract.py
git commit -m "feat(backend): normalize analysis outcome data"
```

---

### Task 3: 单AI失败后自动规则兜底并继续下注

**Files:**
- Modify: `backend/app/api/routes/game.py`
- Modify: `backend/tests/test_game_analysis_trigger_flow.py`

- [ ] **Step 1: 写失败测试，锁住“单AI失败也继续下注”**

```python
async def _boom(*args, **kwargs):
    raise RuntimeError("upstream exploded")

with patch("app.services.game.run_ai_analysis", new=_boom):
    await _run_followup_analysis(1, "下一局AI分析失败(reveal)")

assert sess.status == "等待开奖"
assert sess.pending_bet is not None
assert sess.predict_direction in ("庄", "闲")
```

- [ ] **Step 2: 运行测试，确认红灯**

Run: `python -m pytest backend/tests/test_game_analysis_trigger_flow.py -q`

Expected: FAIL，提示失败后没有下注，或状态回退成 `空闲`。

- [ ] **Step 3: 在 `_run_followup_analysis()` 中接入规则兜底**

```python
try:
    await asyncio.wait_for(_run_cycle(), timeout=_followup_analysis_timeout_seconds())
except Exception as exc:
    logger.warning("single ai failed, switching to rule fallback: %s", exc)
    async with async_session() as session:
        fallback = await run_rule_fallback_analysis(db=session, boot_number=boot_number, diagnostic=str(exc))
        await place_bet(
            db=session,
            game_number=fallback["game_number"],
            direction=fallback["prediction"],
            amount=fallback["bet_amount"],
        )
        await session.commit()
```

- [ ] **Step 4: 失败日志中写清“单AI失败 -> 规则兜底已接管”**

```python
await write_game_log(
    log_session,
    boot_number,
    next_game_number,
    "LOG-MDL-003",
    "规则兜底接管",
    "成功",
    f"单AI失败后已切换规则兜底继续下注：{exc}",
    category="工作流事件",
    priority="P1",
)
```

- [ ] **Step 5: 运行测试，确认绿灯**

Run: `python -m pytest backend/tests/test_game_analysis_trigger_flow.py -q`

Expected: PASS

- [ ] **Step 6: 回归相关测试**

Run: `python -m pytest backend/tests/test_analysis_dedupe.py backend/tests/test_watchdog_auto_repair.py backend/tests/test_system_repair_api.py -q`

Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add backend/app/api/routes/game.py backend/tests/test_game_analysis_trigger_flow.py
git commit -m "feat(backend): fallback to rule prediction when single ai fails"
```

---

### Task 4: 前端接统一 outcome，并把首页改成极简结果卡

**Files:**
- Modify: `frontend/src/types/models.ts`
- Modify: `frontend/src/hooks/useQueries.ts`
- Modify: `frontend/src/components/dashboard/AnalysisPanel.tsx`
- Modify: `frontend/src/components/dashboard/AnalysisPanel.test.tsx`

- [ ] **Step 1: 先写失败测试，锁住首页极简结果卡和规则兜底来源**

```tsx
it('shows a compact outcome card for rule fallback', async () => {
  root.render(
    <AnalysisPanel
      hasGameData
      hasPendingBet={false}
      aiAnalyzing={false}
      workflowStage={{ type: 'analyzed_pending_bet', showAnalysisLoading: false, showCompletedAnalysis: true }}
      analysis={{
        prediction: '庄',
        confidence: 0.61,
        prediction_mode: 'single_ai',
        analysis_outcome: {
          direction: '庄',
          confidence: 0.61,
          confidence_label: '中',
          source: 'rule_fallback',
          short_reason: '本局AI没有及时给出稳定结果，系统已改用规则判断继续下注。',
          final_reason: '五条路里三条继续支持庄，所以最终偏向庄。',
          road_explanations: {} as never,
        },
      }}
    />
  );

  expect(container.innerHTML).toContain('本局建议');
  expect(container.innerHTML).toContain('规则兜底');
  expect(container.innerHTML).not.toContain('上游接口调用失败');
});
```

- [ ] **Step 2: 运行测试，确认红灯**

Run: `npm test -- src/components/dashboard/AnalysisPanel.test.tsx`

Expected: FAIL，提示 `analysis_outcome` 未消费，或旧 UI 仍输出技术文案。

- [ ] **Step 3: 扩展前端类型**

```ts
export interface RoadExplanation {
  trend_label: string;
  tendency: '庄' | '闲' | '中性';
  support_level: '强' | '中' | '弱';
  plain_summary: string;
}

export interface AnalysisOutcome {
  direction: '庄' | '闲';
  confidence: number;
  confidence_label: '高' | '中' | '低';
  source: 'single_ai' | 'rule_fallback';
  short_reason: string;
  final_reason: string;
  fallback_reason?: string | null;
  road_explanations: Record<string, RoadExplanation>;
  technical_diagnostic?: { code?: string | null; message?: string | null } | null;
}
```

- [ ] **Step 4: 把 `AnalysisPanel` 改成极简结果卡**

```tsx
const outcome = analysis?.analysis_outcome;
const direction = outcome?.direction ?? analysis?.prediction;
const sourceLabel = outcome?.source === 'rule_fallback' ? '规则兜底' : '单AI判断';

return (
  <div className="analysis-card dashboard-section-card dashboard-analysis-card">
    <div className="section-header">
      <span className="section-title">智能分析</span>
    </div>
    <div className="analysis-outcome-hero">
      <div className="analysis-outcome-label">本局建议</div>
      <div className="analysis-outcome-direction">{direction}</div>
      <div className="analysis-outcome-tags">
        <span>{sourceLabel}</span>
        <span>{outcome?.confidence_label ?? '中'}</span>
      </div>
      <p>{outcome?.short_reason ?? analysis?.combined_summary}</p>
      <Button type="link">查看详细原因</Button>
    </div>
  </div>
);
```

- [ ] **Step 5: 运行测试，确认绿灯**

Run: `npm test -- src/components/dashboard/AnalysisPanel.test.tsx`

Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add frontend/src/types/models.ts frontend/src/hooks/useQueries.ts frontend/src/components/dashboard/AnalysisPanel.tsx frontend/src/components/dashboard/AnalysisPanel.test.tsx
git commit -m "feat(frontend): simplify analysis panel outcome card"
```

---

### Task 5: 重做详情页为五路解释页

**Files:**
- Modify: `frontend/src/components/dashboard/AnalysisDetailDrawer.tsx`
- Create: `frontend/src/components/dashboard/AnalysisDetailDrawer.test.tsx`

- [ ] **Step 1: 写失败测试，锁住详情页必须展示五条路和最终原因**

```tsx
it('shows five road explanations and final reason', () => {
  render(
    <AnalysisDetailDrawer
      open
      onClose={() => {}}
      outcome={{
        direction: '庄',
        confidence: 0.72,
        confidence_label: '中',
        source: 'rule_fallback',
        short_reason: '当前主走势还偏庄。',
        final_reason: '三条路支持庄，两条路中性，所以最终偏庄。',
        fallback_reason: '单AI没有及时返回，系统改用规则兜底。',
        road_explanations: {
          big_road: { trend_label: '大路连庄', tendency: '庄', support_level: '强', plain_summary: '大路连续走庄，主走势还在延续。' },
          bead_road: { trend_label: '珠盘路偏庄', tendency: '庄', support_level: '中', plain_summary: '珠盘路近期庄更多。' },
          big_eye_road: { trend_label: '大眼仔偏顺', tendency: '庄', support_level: '中', plain_summary: '大眼仔保持顺势。' },
          small_road: { trend_label: '小路中性', tendency: '中性', support_level: '弱', plain_summary: '小路没有明显新方向。' },
          cockroach_road: { trend_label: '螳螂路轻微偏庄', tendency: '庄', support_level: '弱', plain_summary: '螳螂路暂未出现明确反转。' },
        },
      }}
    />
  );

  expect(screen.getByText('五条路怎么看')).toBeTruthy();
  expect(screen.getByText('大路')).toBeTruthy();
  expect(screen.getByText('最终为什么押这个方向')).toBeTruthy();
  expect(screen.getByText('规则兜底')).toBeTruthy();
});
```

- [ ] **Step 2: 运行测试，确认红灯**

Run: `npm test -- src/components/dashboard/AnalysisDetailDrawer.test.tsx`

Expected: FAIL，提示当前详情页还是旧的长文本结构。

- [ ] **Step 3: 把详情页拆成分段卡片**

```tsx
<Drawer open={open} onClose={onClose} title="推理详情">
  <section>
    <h3>本局结论</h3>
    <p>本局建议：{outcome.direction}</p>
    <p>{outcome.short_reason}</p>
  </section>

  <section>
    <h3>五条路怎么看</h3>
    {ROAD_KEYS.map((key) => (
      <article key={key}>
        <h4>{ROAD_LABELS[key]}</h4>
        <p>{outcome.road_explanations[key].plain_summary}</p>
      </article>
    ))}
  </section>

  <section>
    <h3>最终为什么押这个方向</h3>
    <p>{outcome.final_reason}</p>
  </section>
</Drawer>
```

- [ ] **Step 4: 加技术说明折叠区**

```tsx
{outcome.technical_diagnostic ? (
  <Collapse
    items={[
      {
        key: 'diagnostic',
        label: '技术说明',
        children: <p>{outcome.technical_diagnostic.message}</p>,
      },
    ]}
  />
) : null}
```

- [ ] **Step 5: 运行测试，确认绿灯**

Run: `npm test -- src/components/dashboard/AnalysisDetailDrawer.test.tsx`

Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add frontend/src/components/dashboard/AnalysisDetailDrawer.tsx frontend/src/components/dashboard/AnalysisDetailDrawer.test.tsx
git commit -m "feat(frontend): rebuild analysis detail drawer"
```

---

### Task 6: 全量验证与真实流程复测

**Files:**
- Verify only

- [ ] **Step 1: 跑后端测试**

Run: `python -m pytest backend/tests/test_analysis_outcome_contract.py backend/tests/test_game_analysis_trigger_flow.py backend/tests/test_analysis_dedupe.py backend/tests/test_watchdog_auto_repair.py backend/tests/test_system_repair_api.py -q`

Expected: PASS

- [ ] **Step 2: 跑前端测试**

Run: `npm test -- src/components/dashboard/AnalysisPanel.test.tsx src/components/dashboard/AnalysisDetailDrawer.test.tsx`

Expected: PASS

- [ ] **Step 3: 跑前端构建**

Run: `npm run build`

Expected: build succeeds without TypeScript errors

- [ ] **Step 4: 真实流程复测**

Run this browser workflow:

```text
1. 使用 1111 / 1111 登录
2. 跑一轮正常单AI成功 -> 自动下注 -> 开奖
3. 人工制造或模拟单AI失败
4. 确认系统自动切规则兜底并继续下注
5. 检查首页只显示极简结果卡
6. 检查详情页显示五条路解释、最终原因、来源说明
```

Expected:

- 每一局都有下注
- 首页不再出现技术失败大段正文
- 详情页能明确解释“为什么最终押庄/押闲”

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: deliver analysis ui and fallback workflow"
```
