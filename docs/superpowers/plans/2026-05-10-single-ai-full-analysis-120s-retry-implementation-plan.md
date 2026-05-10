# 单AI满血分析 120 秒窗口与手动重试 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把单AI模式改成开奖后启动、固定 120 秒满血分析、失败不降级、首页明确失败原因并支持手动重新分析的新工作流。

**Architecture:** 后端把“单次分析结果”和“分析轮次状态”拆开管理，在内存态 `ManualSession` 与持久态 `SystemState` 同步记录单AI分析轮次、阶段、失败原因和可重试状态。前端基于 `/api/system/state` 与 `/api/analysis/latest` 的新字段，拆分“分析中 / 分析完成 / 分析失败”三类界面，并通过单独的重试接口手动开启下一轮新的 120 秒分析。

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, Python, React, TypeScript, React Query, Ant Design, Vitest

---

### Task 1: 建立单AI分析轮次契约

**Files:**
- Create: `backend/alembic/versions/20260510_0009_single_ai_analysis_cycle.py`
- Modify: `backend/app/models/schemas.py`
- Modify: `backend/app/services/game/session.py`
- Modify: `backend/app/services/game/state.py`
- Modify: `backend/app/api/routes/system.py`
- Modify: `backend/app/api/routes/analysis.py`
- Modify: `frontend/src/types/models.ts`
- Modify: `frontend/src/services/api.ts`
- Test: `backend/tests/test_single_ai_analysis_cycle_contract.py`

- [ ] **Step 1: 先写后端契约红测**

```python
def test_single_ai_failed_cycle_is_exposed_by_state_and_latest_analysis():
    state_payload = asyncio.run(_get_state_payload_for_failed_single_ai_cycle())
    latest_payload = asyncio.run(_get_latest_analysis_payload_for_failed_single_ai_cycle())

    assert state_payload["analysis_cycle"]["status"] == "failed"
    assert state_payload["analysis_cycle"]["stage"] == "结果校验"
    assert state_payload["analysis_cycle"]["failure_reason"]["code"] == "response_incomplete"
    assert state_payload["analysis_cycle"]["retryable"] is True

    assert latest_payload["analysis_cycle"]["status"] == "failed"
    assert latest_payload["analysis_outcome"] is None
    assert latest_payload["combined_model"]["prediction"] is None
```

- [ ] **Step 2: 跑红测确认当前接口还没有分析轮次字段**

Run: `cd /workspace/backend && python -m pytest tests/test_single_ai_analysis_cycle_contract.py -q`
Expected: FAIL，提示 `/state` 或 `/analysis/latest` 返回中缺少 `analysis_cycle`

- [ ] **Step 3: 给持久态和内存态补齐分析轮次字段**

```python
class ManualSession:
    analysis_cycle: Optional[Dict] = None


class SystemState(Base):
    analysis_cycle_status = Column(String(20), nullable=True)
    analysis_cycle_stage = Column(String(20), nullable=True)
    analysis_cycle_attempt = Column(Integer, nullable=True)
    analysis_cycle_started_at = Column(DateTime, nullable=True)
    analysis_cycle_deadline_at = Column(DateTime, nullable=True)
    analysis_failure_code = Column(String(64), nullable=True)
    analysis_failure_message = Column(Text, nullable=True)
    analysis_retryable = Column(Boolean, nullable=False, server_default=sa.text("0"))
```

- [ ] **Step 4: 新增迁移并同步 `/state` 与 `/analysis/latest` 输出**

```python
def _serialize_analysis_cycle(sess, state) -> dict | None:
    source = sess.analysis_cycle or {}
    return {
        "status": source.get("status") or state.analysis_cycle_status,
        "stage": source.get("stage") or state.analysis_cycle_stage,
        "attempt": source.get("attempt") or state.analysis_cycle_attempt,
        "started_at": source.get("started_at"),
        "deadline_at": source.get("deadline_at"),
        "retryable": bool(source.get("retryable") if "retryable" in source else state.analysis_retryable),
        "failure_reason": {
            "code": source.get("failure_code") or state.analysis_failure_code,
            "message": source.get("failure_message") or state.analysis_failure_message,
        },
    }
```

- [ ] **Step 5: 给前端类型和 API 契约补上新字段**

```ts
export interface AnalysisFailureReason {
  code: 'timeout' | 'response_incomplete' | 'invalid_direction' | 'service_unavailable' | 'unknown';
  message: string | null;
}

export interface AnalysisCycle {
  status: 'idle' | 'running' | 'failed' | 'succeeded';
  stage: '数据归集' | '满血研判' | '结果校验' | '结论整理' | null;
  attempt: number;
  started_at: string | null;
  deadline_at: string | null;
  retryable: boolean;
  failure_reason: AnalysisFailureReason | null;
}
```

- [ ] **Step 6: 跑测试确认契约转绿**

Run: `cd /workspace/backend && python -m pytest tests/test_single_ai_analysis_cycle_contract.py -q`
Expected: PASS

- [ ] **Step 7: 提交 Task 1**

```bash
git add backend/alembic/versions/20260510_0009_single_ai_analysis_cycle.py \
  backend/app/models/schemas.py \
  backend/app/services/game/session.py \
  backend/app/services/game/state.py \
  backend/app/api/routes/system.py \
  backend/app/api/routes/analysis.py \
  frontend/src/types/models.ts \
  frontend/src/services/api.ts \
  backend/tests/test_single_ai_analysis_cycle_contract.py
git commit -m "feat: add single ai analysis cycle contract"
```

### Task 2: 重写单AI follow-up 工作流，失败不再规则兜底

**Files:**
- Modify: `backend/app/api/routes/game.py`
- Modify: `backend/app/api/routes/schemas.py`
- Modify: `backend/app/services/game/analysis.py`
- Modify: `backend/app/services/game/session.py`
- Modify: `backend/app/services/game/state.py`
- Test: `backend/tests/test_game_analysis_trigger_flow.py`
- Test: `backend/tests/test_single_ai_analysis.py`

- [ ] **Step 1: 先把旧兜底行为改成红测**

```python
def test_followup_analysis_timeout_marks_failed_cycle_without_rule_fallback():
    result = asyncio.run(_run_single_ai_followup_timeout())

    assert result["mem_status"] == "等待开奖"
    assert result["analysis_cycle"]["status"] == "failed"
    assert result["analysis_cycle"]["failure_reason"]["code"] == "timeout"
    assert result["bet_direction"] is None
    assert result["analysis_outcome"] is None


def test_retry_endpoint_starts_new_analysis_round_only_once():
    first = client.post("/api/games/analysis/retry", json={"boot_number": boot, "game_number": 2})
    second = client.post("/api/games/analysis/retry", json={"boot_number": boot, "game_number": 2})

    assert first.status_code == 200
    assert second.status_code == 409
```

- [ ] **Step 2: 跑红测，确认当前代码仍会下注并走 `rule_fallback`**

Run: `cd /workspace/backend && python -m pytest tests/test_game_analysis_trigger_flow.py tests/test_single_ai_analysis.py -q`
Expected: FAIL，旧断言里还能看到下注记录或 `LOG-MDL-003`

- [ ] **Step 3: 删除 `_run_single_ai_rule_fallback()`，改成单AI轮次状态机**

```python
def _new_analysis_cycle(attempt: int) -> dict:
    started_at = datetime.utcnow()
    return {
        "status": "running",
        "stage": "数据归集",
        "attempt": attempt,
        "started_at": started_at.isoformat(),
        "deadline_at": (started_at + timedelta(seconds=120)).isoformat(),
        "retryable": False,
        "failure_code": None,
        "failure_message": None,
    }


def _mark_cycle_failed(cycle: dict, code: str, message: str, stage: str) -> dict:
    cycle.update({
        "status": "failed",
        "stage": stage,
        "retryable": True,
        "failure_code": code,
        "failure_message": message,
    })
    return cycle
```

- [ ] **Step 4: 在 `_run_followup_analysis()` 中收口 120 秒窗口与失败态**

```python
if prediction_mode == "single_ai":
    cycle = _new_analysis_cycle(attempt=_next_attempt(sess))
    await _sync_analysis_cycle(session, sess, state, cycle)
    try:
        await asyncio.wait_for(_run_cycle(), timeout=120.0)
        cycle["status"] = "succeeded"
    except asyncio.TimeoutError:
        _clear_runtime_prediction_snapshot(sess, state)
        _mark_cycle_failed(cycle, "timeout", "本轮满血分析在 120 秒内没有完成，因此当前还没有形成有效预测结果。", "结果校验")
        await _write_analysis_failure_log(...)
        return
```

- [ ] **Step 5: 新增手动重试接口，只允许失败态开启新轮次**

```python
class RetrySingleAiAnalysisRequest(BaseModel):
    boot_number: int = Field(..., ge=1)
    game_number: int = Field(..., ge=1)


@router.post("/analysis/retry")
async def retry_single_ai_analysis(req: RetrySingleAiAnalysisRequest, _: dict = Depends(get_current_user)):
    if sess.prediction_mode != "single_ai":
        raise HTTPException(409, "当前不是单AI模式")
    if not _can_retry_failed_cycle(sess, req.boot_number, req.game_number):
        raise HTTPException(409, "当前这局还不能重新分析")
    start_background_task("analysis", _run_followup_analysis(req.boot_number, "用户手动重新发起单AI分析"), boot_number=req.boot_number, dedupe_key=f"analysis:{req.boot_number}:retry")
    return {"success": True, "message": "已开始新一轮满血分析"}
```

- [ ] **Step 6: 给单AI失败类型补统一错误码，避免前端只能猜原文**

```python
return {
    "success": False,
    "reason": str(e),
    "error_type": "single_ai_timeout",
    "analysis_outcome": None,
    "prediction": None,
    "confidence": None,
}
```

- [ ] **Step 7: 跑后端回归，确认超时/异常不再下注**

Run: `cd /workspace/backend && python -m pytest tests/test_game_analysis_trigger_flow.py tests/test_single_ai_analysis.py tests/test_analysis_outcome_contract.py -q`
Expected: PASS

- [ ] **Step 8: 提交 Task 2**

```bash
git add backend/app/api/routes/game.py \
  backend/app/api/routes/schemas.py \
  backend/app/services/game/analysis.py \
  backend/app/services/game/session.py \
  backend/app/services/game/state.py \
  backend/tests/test_game_analysis_trigger_flow.py \
  backend/tests/test_single_ai_analysis.py
git commit -m "feat: replace single ai fallback with failed cycle and manual retry"
```

### Task 3: 前端实现“分析中 / 失败 / 完成”三态与手动重试

**Files:**
- Modify: `frontend/src/services/api.ts`
- Modify: `frontend/src/hooks/useQueries.ts`
- Modify: `frontend/src/components/dashboard/AnalysisPanel.tsx`
- Modify: `frontend/src/components/dashboard/AnalysisDetailDrawer.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Test: `frontend/src/components/dashboard/AnalysisPanel.test.tsx`
- Test: `frontend/src/services/adminAlertsApi.test.ts`

- [ ] **Step 1: 先写前端红测，锁住失败态和重试按钮**

```tsx
it('renders failed single-ai panel with chinese reason and retry button', async () => {
  renderPanel({
    analysis: {
      prediction: null,
      confidence: 0,
      combined_summary: '',
      prediction_mode: 'single_ai',
      analysis_cycle: {
        status: 'failed',
        stage: '结果校验',
        attempt: 1,
        retryable: true,
        failure_reason: {
          code: 'response_incomplete',
          message: '这次分析已经返回内容，但结果不完整，系统无法把它当成有效预测结果。',
        },
      },
      analysis_outcome: null,
    },
  })

  expect(screen.getByText('本轮分析未完成')).toBeTruthy()
  expect(screen.getByText('重新分析')).toBeTruthy()
  expect(screen.queryByText('已完成研判')).toBeNull()
})
```

- [ ] **Step 2: 跑红测确认当前 `AnalysisPanel` 只有“整理中”占位态**

Run: `cd /workspace/frontend && npx vitest run src/components/dashboard/AnalysisPanel.test.tsx`
Expected: FAIL，找不到“本轮分析未完成”或“重新分析”

- [ ] **Step 3: 新增重试 API 与 mutation**

```ts
export const retrySingleAiAnalysis = async (payload: { boot_number: number; game_number: number }) => {
  return api.post('/games/analysis/retry', payload);
};

export const useRetrySingleAiAnalysisMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.retrySingleAiAnalysis,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.systemState() });
      queryClient.invalidateQueries({ queryKey: queryKeys.analysis() });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    },
  });
};
```

- [ ] **Step 4: 在 `AnalysisPanel` 拆出进行态进度条与失败态卡片**

```tsx
const progressStages = ['数据归集', '满血研判', '结果校验', '结论整理'] as const;
const cycle = analysis?.analysis_cycle ?? systemState?.analysis_cycle ?? null;

if (cycle?.status === 'running') {
  return <RunningCycleCard stage={cycle.stage} stages={progressStages} />;
}

if (cycle?.status === 'failed') {
  return (
    <FailedCycleCard
      title="本轮分析未完成"
      reason={cycle.failure_reason?.message || '当前还没有形成有效预测结果。'}
      onRetry={() => retryMutation.mutate({ boot_number: systemState!.boot_number, game_number: systemState!.next_game_number })}
      retrying={retryMutation.isPending}
      retryable={cycle.retryable}
    />
  );
}
```

- [ ] **Step 5: 保持详情抽屉只服务成功态**

```tsx
const outcome = isValidOutcome(explicitOutcome) ? explicitOutcome : null;
const canOpenDetail = !!outcome && cycle?.status !== 'failed';

<Button disabled={!canOpenDetail} onClick={() => setDetailOpen(true)}>
  {detailEntryLabel}
</Button>
{canOpenDetail ? <AnalysisDetailDrawer open={detailOpen} onClose={() => setDetailOpen(false)} outcome={outcome} /> : null}
```

- [ ] **Step 6: 在 `DashboardPage` 里把重试后的查询失效和按钮加载态接上**

```tsx
const retrySingleAiAnalysis = useRetrySingleAiAnalysisMutation();

<AnalysisPanel
  analysis={analysis}
  hasGameData={hasGameData}
  hasPendingBet={hasPendingBet}
  aiAnalyzing={aiAnalyzing}
  workflowStage={workflowStage}
  onRetrySingleAiAnalysis={retrySingleAiAnalysis.mutate}
  retryingSingleAiAnalysis={retrySingleAiAnalysis.isPending}
/>
```

- [ ] **Step 7: 跑前端单测确认失败态、加载态和成功态共存正确**

Run: `cd /workspace/frontend && npx vitest run src/components/dashboard/AnalysisPanel.test.tsx`
Expected: PASS

- [ ] **Step 8: 提交 Task 3**

```bash
git add frontend/src/services/api.ts \
  frontend/src/hooks/useQueries.ts \
  frontend/src/components/dashboard/AnalysisPanel.tsx \
  frontend/src/components/dashboard/AnalysisDetailDrawer.tsx \
  frontend/src/pages/DashboardPage.tsx \
  frontend/src/components/dashboard/AnalysisPanel.test.tsx \
  frontend/src/services/adminAlertsApi.test.ts
git commit -m "feat: add single ai failure panel and retry action"
```

### Task 4: 日志与失败说明中文化，保留失败与重试记录

**Files:**
- Modify: `backend/app/api/routes/game.py`
- Modify: `frontend/src/utils/i18nErrors.ts`
- Modify: `frontend/src/utils/logHumanizer.ts`
- Modify: `frontend/src/pages/LogsPage.tsx`
- Test: `frontend/src/utils/i18nErrors.test.ts`
- Test: `frontend/src/utils/logHumanizer.test.ts`
- Test: `frontend/src/pages/LogsPage.test.tsx`

- [ ] **Step 1: 先给新失败类型和新日志事件写前端红测**

```ts
it('rewrites single-ai full-analysis timeout into user-facing chinese', () => {
  expect(toCnAnalysisDiagnostic('single_ai_timeout')).toBe(
    '本轮满血分析在 120 秒内没有完成，因此当前还没有形成有效预测结果。'
  );
});

it('humanizes LOG-MDL-004 and LOG-MDL-005 without raw english text', () => {
  const failed = humanizeLog({ ...baseLog, event_code: 'LOG-MDL-004', description: 'analysis timeout after 120.00s' });
  const retried = humanizeLog({ ...baseLog, event_code: 'LOG-MDL-005', description: 'manual retry started' });

  expect(failed.title).toContain('本轮分析未完成')
  expect(retried.title).toContain('已重新发起满血分析')
  expect(JSON.stringify(failed)).not.toContain('timeout')
});
```

- [ ] **Step 2: 跑红测确认当前日志语义仍然停留在 `LOG-MDL-002/003` 旧世界**

Run: `cd /workspace/frontend && npx vitest run src/utils/i18nErrors.test.ts src/utils/logHumanizer.test.ts src/pages/LogsPage.test.tsx`
Expected: FAIL，找不到新事件或仍出现 `rule_fallback`

- [ ] **Step 3: 在后端写入新的失败/重试日志事件**

```python
await write_game_log(
    session,
    boot_number,
    sess.next_game_number,
    "LOG-MDL-004",
    "单AI满血分析未完成",
    "失败",
    user_facing_message,
    category="工作流事件",
    priority="P1",
)

await write_game_log(
    session,
    boot_number,
    sess.next_game_number,
    "LOG-MDL-005",
    "用户手动重新发起单AI分析",
    "开始",
    "用户点击“重新分析”后，系统已开始新一轮 120 秒满血分析。",
    category="工作流事件",
    priority="P2",
)
```

- [ ] **Step 4: 把失败诊断和日志人话规则统一成四类原因**

```ts
if (s.includes('response_incomplete')) {
  return '这次分析已经返回内容，但结果不完整，系统无法把它当成有效预测结果。';
}
if (s.includes('invalid_direction')) {
  return '这次分析返回了内容，但没有形成可识别的庄闲方向，因此当前无法生成有效预测结果。';
}
if (s.includes('service_unavailable')) {
  return '这次满血分析在请求过程中遇到服务波动，因此当前还没有拿到稳定结果。';
}
```

- [ ] **Step 5: 更新日志页断言，确认失败与手动重试都保留在记录中**

```tsx
expect(modalText).toContain('本轮分析未完成')
expect(modalText).toContain('已重新发起满血分析')
expect(modalText).not.toContain('rule_fallback')
expect(modalText).not.toContain('analysis timeout after 120.00s')
```

- [ ] **Step 6: 跑前端日志相关回归**

Run: `cd /workspace/frontend && npx vitest run src/utils/i18nErrors.test.ts src/utils/logHumanizer.test.ts src/pages/LogsPage.test.tsx`
Expected: PASS

- [ ] **Step 7: 提交 Task 4**

```bash
git add backend/app/api/routes/game.py \
  frontend/src/utils/i18nErrors.ts \
  frontend/src/utils/logHumanizer.ts \
  frontend/src/pages/LogsPage.tsx \
  frontend/src/utils/i18nErrors.test.ts \
  frontend/src/utils/logHumanizer.test.ts \
  frontend/src/pages/LogsPage.test.tsx
git commit -m "feat: record single ai failed cycle and retry logs"
```

### Task 5: 全链路回归、构建与人工验证

**Files:**
- Modify: `frontend/src/components/dashboard/AnalysisPanel.test.tsx`
- Modify: `backend/tests/test_game_analysis_trigger_flow.py`
- Modify: `backend/tests/test_single_ai_analysis_cycle_contract.py`
- Modify: `docs/superpowers/plans/2026-05-10-single-ai-full-analysis-120s-retry-implementation-plan.md`

- [ ] **Step 1: 跑后端核心测试集**

Run: `cd /workspace/backend && python -m pytest tests/test_single_ai_analysis_cycle_contract.py tests/test_game_analysis_trigger_flow.py tests/test_single_ai_analysis.py tests/test_analysis_outcome_contract.py -q`
Expected: PASS

- [ ] **Step 2: 跑前端核心测试集**

Run: `cd /workspace/frontend && npx vitest run src/components/dashboard/AnalysisPanel.test.tsx src/components/dashboard/AnalysisDetailDrawer.test.tsx src/utils/i18nErrors.test.ts src/utils/logHumanizer.test.ts src/pages/LogsPage.test.tsx`
Expected: PASS

- [ ] **Step 3: 跑前后端构建或最小健康检查**

Run: `cd /workspace/frontend && npm run build`
Expected: build 成功，无 TypeScript 错误

Run: `cd /workspace/backend && python -m pytest tests/test_admin_maintenance_api.py -q`
Expected: PASS，确保之前告警确认能力没有被误伤

- [ ] **Step 4: 做一次人工流程验证**

```text
1. 录入开奖结果，确认首页进入“分析中”并显示阶段进度。
2. 模拟超时/无效结构，确认首页进入“本轮分析未完成”，没有下注、没有完成态。
3. 点击“重新分析”，确认按钮进入加载态，日志新增“用户手动重新发起单AI分析”。
4. 第二轮返回有效结果，确认首页恢复“本局决断 / 决策机制 / 决断强度”。
5. 打开记录页，确认失败与重试日志都保留且没有英文技术串。
```

- [ ] **Step 5: 提交 Task 5**

```bash
git add backend/tests/test_single_ai_analysis_cycle_contract.py \
  backend/tests/test_game_analysis_trigger_flow.py \
  frontend/src/components/dashboard/AnalysisPanel.test.tsx \
  docs/superpowers/plans/2026-05-10-single-ai-full-analysis-120s-retry-implementation-plan.md
git commit -m "test: verify single ai failed cycle and retry flow"
```
