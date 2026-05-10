# Dashboard Workflow Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 统一首页 `分析 -> 自动下注 -> 等待开奖 -> 开奖结算 -> 下一局分析` 的前端工作流状态，消除各模块状态打架与显示错位。

**Architecture:** 以 `systemState + analysis` 推导一个共享的 `workflow stage`，让 `DashboardHeader`、`WorkflowStatusBar`、`AnalysisPanel` 不再各自拼条件。通过补齐 `ai_analysis / state_update / bet_placed / game_revealed` 的前端同步链路，保证“分析结果”“已下注”“等待开奖”来自同一套状态来源。

**Tech Stack:** React, TypeScript, Vitest, React Query, WebSocket optimistic updates, Ant Design

---

### Task 1: 建立共享工作流阶段与红测

**Files:**
- Modify: `frontend/src/utils/systemFlowConsistency.ts`
- Create: `frontend/src/utils/systemFlowConsistency.test.ts`
- Modify: `frontend/src/components/dashboard/AnalysisPanel.test.tsx`
- Modify: `frontend/src/components/dashboard/DashboardHeader.test.tsx`

- [ ] **Step 1: 先写工作流阶段红测**

```ts
import { describe, expect, it } from 'vitest';
import {
  deriveDashboardWorkflowStage,
  type DashboardWorkflowStage,
} from './systemFlowConsistency';

describe('deriveDashboardWorkflowStage', () => {
  it('returns waiting_reveal when a pending bet exists', () => {
    const stage = deriveDashboardWorkflowStage({
      hasGameData: true,
      hasPendingBet: true,
      systemStatus: '等待开奖',
      nextGameNumber: 18,
      analysis: {
        prediction: '庄',
        confidence: 0.78,
        combined_summary: '综合建议本局继续跟庄',
      },
      analysisFetching: true,
    });

    expect(stage.type).toBe<DashboardWorkflowStage['type']>('waiting_reveal');
    expect(stage.showAnalysisLoading).toBe(false);
    expect(stage.showCompletedAnalysis).toBe(true);
  });

  it('returns analyzing only before a pending bet exists', () => {
    const stage = deriveDashboardWorkflowStage({
      hasGameData: true,
      hasPendingBet: false,
      systemStatus: '分析中',
      nextGameNumber: 18,
      analysis: null,
      analysisFetching: true,
    });

    expect(stage.type).toBe<DashboardWorkflowStage['type']>('analyzing');
    expect(stage.showAnalysisLoading).toBe(true);
    expect(stage.showCompletedAnalysis).toBe(false);
  });

  it('returns analyzed_pending_bet when analysis is ready but pending bet is not synced yet', () => {
    const stage = deriveDashboardWorkflowStage({
      hasGameData: true,
      hasPendingBet: false,
      systemStatus: '运行中',
      nextGameNumber: 18,
      analysis: {
        prediction: '庄',
        confidence: 0.78,
        combined_summary: '综合建议本局继续跟庄',
      },
      analysisFetching: false,
    });

    expect(stage.type).toBe<DashboardWorkflowStage['type']>('analyzed_pending_bet');
    expect(stage.showCompletedAnalysis).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试，确认它先失败**

Run: `npm test -- src/utils/systemFlowConsistency.test.ts`

Expected: FAIL，报 `deriveDashboardWorkflowStage` 未定义或行为不满足预期

- [ ] **Step 3: 在共享工具里补最小实现**

```ts
export type PredictionMode = 'ai' | 'single_ai' | 'rule';

export interface WorkflowAnalysisSnapshot {
  prediction?: string | null;
  confidence?: number | null;
  combined_summary?: string | null;
}

export interface DashboardWorkflowInput {
  hasGameData: boolean;
  hasPendingBet: boolean;
  systemStatus?: string | null;
  nextGameNumber?: number | null;
  analysis: WorkflowAnalysisSnapshot | null;
  analysisFetching: boolean;
}

export interface DashboardWorkflowStage {
  type:
    | 'idle'
    | 'analyzing'
    | 'analyzed_pending_bet'
    | 'waiting_reveal'
    | 'boot_finished';
  showAnalysisLoading: boolean;
  showCompletedAnalysis: boolean;
}

export const deriveDashboardWorkflowStage = (
  input: DashboardWorkflowInput,
): DashboardWorkflowStage => {
  const nextGameNumber = input.nextGameNumber || 0;

  if (!input.hasGameData) {
    return {
      type: 'idle',
      showAnalysisLoading: false,
      showCompletedAnalysis: false,
    };
  }

  if (nextGameNumber > 72) {
    return {
      type: 'boot_finished',
      showAnalysisLoading: false,
      showCompletedAnalysis: false,
    };
  }

  if (input.hasPendingBet) {
    return {
      type: 'waiting_reveal',
      showAnalysisLoading: false,
      showCompletedAnalysis: !!input.analysis,
    };
  }

  if (input.analysisFetching || input.systemStatus === '分析中') {
    return {
      type: 'analyzing',
      showAnalysisLoading: true,
      showCompletedAnalysis: false,
    };
  }

  if (input.analysis?.prediction) {
    return {
      type: 'analyzed_pending_bet',
      showAnalysisLoading: false,
      showCompletedAnalysis: true,
    };
  }

  return {
    type: 'idle',
    showAnalysisLoading: false,
    showCompletedAnalysis: false,
  };
};
```

- [ ] **Step 4: 给组件补一条回归测试，锁住“已下注仍显示分析结果”**

```ts
it('keeps the completed analysis visible after auto bet is placed', async () => {
  await act(async () => {
    root.render(
      <AnalysisPanel
        hasGameData
        hasPendingBet
        aiAnalyzing
        analysis={{
          prediction: '庄',
          confidence: 0.76,
          combined_summary: '综合建议本局继续跟庄',
          prediction_mode: 'single_ai',
        }}
      />
    );
  });

  expect(container.innerHTML).toContain('综合建议本局继续跟庄');
  expect(container.innerHTML).not.toContain('系统正在分析下一局，请稍候...');
});
```

- [ ] **Step 5: 再跑测试，确认转绿**

Run: `npm test -- src/utils/systemFlowConsistency.test.ts && npm test -- src/components/dashboard/AnalysisPanel.test.tsx`

Expected: PASS，工作流阶段判断和分析面板回归测试同时通过

- [ ] **Step 6: 提交**

```bash
git add frontend/src/utils/systemFlowConsistency.ts frontend/src/utils/systemFlowConsistency.test.ts frontend/src/components/dashboard/AnalysisPanel.test.tsx frontend/src/components/dashboard/DashboardHeader.test.tsx
git commit -m "test(frontend): lock dashboard workflow stages"
```

### Task 2: 补齐实时状态同步链路

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Modify: `frontend/src/hooks/useQueries.ts`
- Modify: `frontend/src/types/models.ts`
- Test: `frontend/src/pages/DashboardPage.test.tsx`

- [ ] **Step 1: 写一条红测，锁住 websocket 事件后状态要完整更新**

```ts
it('keeps pending bet, next game number, and analysis aligned after bet and analysis events', async () => {
  const nextState = applyDashboardRealtimeUpdate(
    {
      status: '分析中',
      game_number: 17,
      next_game_number: 18,
      predict_direction: '庄',
      predict_confidence: 0.78,
      pending_bet: null,
    },
    {
      type: 'bet_placed',
      payload: {
        game_number: 18,
        direction: '庄',
        amount: 100,
        tier: '标准',
      },
    },
  );

  expect(nextState.status).toBe('等待开奖');
  expect(nextState.pending_bet?.game_number).toBe(18);
  expect(nextState.next_game_number).toBe(18);
});
```

- [ ] **Step 2: 运行红测**

Run: `npm test -- src/pages/DashboardPage.test.tsx`

Expected: FAIL，报 `applyDashboardRealtimeUpdate` 未定义或状态字段未完整更新

- [ ] **Step 3: 抽出并实现前端实时状态合并函数**

```ts
export const applyDashboardRealtimeUpdate = (
  current: SystemState,
  event:
    | { type: 'bet_placed'; payload: { game_number: number; direction: string; amount: number; tier: string } }
    | { type: 'game_revealed'; payload: { game_number: number; balance?: number } }
    | { type: 'state_update'; payload: Partial<SystemState> },
): SystemState => {
  if (event.type === 'bet_placed') {
    return {
      ...current,
      status: '等待开奖',
      pending_bet: {
        direction: event.payload.direction,
        amount: event.payload.amount,
        tier: event.payload.tier,
        game_number: event.payload.game_number,
        time: new Date().toISOString(),
      },
      next_game_number: event.payload.game_number,
      predict_direction: event.payload.direction,
    };
  }

  if (event.type === 'game_revealed') {
    return {
      ...current,
      status: '分析中',
      game_number: event.payload.game_number,
      next_game_number: event.payload.game_number + 1,
      pending_bet: null,
      balance: typeof event.payload.balance === 'number' ? event.payload.balance : current.balance,
    };
  }

  return {
    ...current,
    ...event.payload,
  };
};
```

- [ ] **Step 4: 在 `DashboardPage` 里接上 `onAnalysis` 和完整状态更新**

```ts
const updateAnalysisOptimistically = useUpdateAnalysisOptimistically();

useWebSocket({
  onAnalysis: (data) => {
    updateAnalysisOptimistically({
      banker_summary: data.banker_summary || '',
      player_summary: data.player_summary || '',
      combined_summary: data.combined_summary || '',
      confidence: data.confidence || 0,
      bet_tier: data.bet_tier || '标准',
      prediction: data.prediction || null,
      bet_amount: data.bet_amount || null,
      prediction_mode: data.prediction_mode,
      engine: data.engine || null,
      reasoning_points: data.reasoning_points || [],
      reasoning_detail: data.reasoning_detail || null,
    });
  },
  onBetPlaced: (data) => {
    updateStateOptimistically((old) =>
      old ? applyDashboardRealtimeUpdate(old, { type: 'bet_placed', payload: data }) : old,
    );
  },
  onGameRevealed: (data) => {
    updateStateOptimistically((old) =>
      old ? applyDashboardRealtimeUpdate(old, { type: 'game_revealed', payload: data }) : old,
    );
  },
  onStateUpdate: (data) => {
    updateStateOptimistically((old) =>
      old ? applyDashboardRealtimeUpdate(old, { type: 'state_update', payload: data }) : old,
    );
  },
});
```

- [ ] **Step 5: 让 `useUpdateStateOptimistically` 支持函数式更新**

```ts
return async (
  updates: Partial<SystemState> | ((oldData: SystemState | undefined) => SystemState | undefined),
) => {
  await queryClient.cancelQueries({ queryKey: queryKeys.systemState() });

  queryClient.setQueryData(queryKeys.systemState(), (oldData: SystemState | undefined) => {
    if (typeof updates === 'function') {
      return updates(oldData);
    }
    if (!oldData) return oldData;
    return { ...oldData, ...updates };
  });
};
```

- [ ] **Step 6: 跑测试确认状态同步转绿**

Run: `npm test -- src/pages/DashboardPage.test.tsx`

Expected: PASS，说明 `pending_bet / next_game_number / status / analysis` 进入同一条同步链

- [ ] **Step 7: 提交**

```bash
git add frontend/src/pages/DashboardPage.tsx frontend/src/hooks/useQueries.ts frontend/src/types/models.ts frontend/src/pages/DashboardPage.test.tsx
git commit -m "fix(frontend): align realtime dashboard workflow state"
```

### Task 3: 让三块 UI 使用同一套工作流阶段

**Files:**
- Modify: `frontend/src/components/dashboard/DashboardHeader.tsx`
- Modify: `frontend/src/components/dashboard/WorkflowStatusBar.tsx`
- Modify: `frontend/src/components/dashboard/AnalysisPanel.tsx`
- Test: `frontend/src/components/dashboard/DashboardHeader.test.tsx`
- Test: `frontend/src/components/dashboard/AnalysisPanel.test.tsx`

- [ ] **Step 1: 写 UI 红测，锁住三个区域都按同一阶段渲染**

```ts
it('shows waiting reveal copy consistently across header and workflow bar', () => {
  const stage = deriveDashboardWorkflowStage({
    hasGameData: true,
    hasPendingBet: true,
    systemStatus: '等待开奖',
    nextGameNumber: 18,
    analysis: {
      prediction: '庄',
      confidence: 0.78,
      combined_summary: '综合建议本局继续跟庄',
    },
    analysisFetching: false,
  });

  expect(stage.type).toBe('waiting_reveal');
});
```

- [ ] **Step 2: 运行红测**

Run: `npm test -- src/components/dashboard/DashboardHeader.test.tsx && npm test -- src/components/dashboard/AnalysisPanel.test.tsx`

Expected: FAIL，说明组件还没统一依赖共享阶段

- [ ] **Step 3: 在 `DashboardPage` 里统一生成阶段并传给子组件**

```ts
const workflowStage = useMemo(
  () =>
    deriveDashboardWorkflowStage({
      hasGameData,
      hasPendingBet,
      systemStatus: systemState?.status,
      nextGameNumber: systemState?.next_game_number,
      analysis: analysis ?? null,
      analysisFetching,
    }),
  [hasGameData, hasPendingBet, systemState?.status, systemState?.next_game_number, analysis, analysisFetching],
);
```

- [ ] **Step 4: 修改 `DashboardHeader`、`WorkflowStatusBar`、`AnalysisPanel` 用阶段而不是散乱条件**

```ts
// DashboardHeader
const nextGameLabel =
  workflowStage.type === 'waiting_reveal' && systemState?.pending_bet
    ? `第 ${systemState.pending_bet.game_number} 局`
    : `第 ${systemState?.next_game_number || (systemState?.game_number || 0) + 1} 局`;

// WorkflowStatusBar
if (workflowStage.type === 'waiting_reveal') {
  return {
    title: `第 ${pendingGameNumber} 局已下注，等待开奖结果`,
    subtitle: '请点击右侧【🎯 开奖】按钮录入本局结果',
  };
}

// AnalysisPanel
if (workflowStage.showAnalysisLoading) {
  return <LoadingState />;
}
```

- [ ] **Step 5: 跑组件测试和回归测试**

Run: `npm test -- src/components/dashboard/DashboardHeader.test.tsx && npm test -- src/components/dashboard/WorkflowStatusBar.test.tsx && npm test -- src/components/dashboard/AnalysisPanel.test.tsx`

Expected: PASS，三个展示区在相同阶段下给出一致文案

- [ ] **Step 6: 提交**

```bash
git add frontend/src/components/dashboard/DashboardHeader.tsx frontend/src/components/dashboard/WorkflowStatusBar.tsx frontend/src/components/dashboard/AnalysisPanel.tsx frontend/src/components/dashboard/DashboardHeader.test.tsx frontend/src/components/dashboard/AnalysisPanel.test.tsx
git commit -m "refactor(frontend): unify dashboard workflow presentation"
```

### Task 4: 全量验证与线上复核

**Files:**
- Modify: `frontend/src/pages/AdminMobileLayoutRegression.test.ts` (仅在需要补 workflow 回归时)
- Verify: `frontend/src/pages/DashboardPage.tsx`
- Verify: `frontend/src/components/dashboard/AnalysisPanel.tsx`
- Verify: `frontend/src/components/dashboard/WorkflowStatusBar.tsx`

- [ ] **Step 1: 运行目标测试**

Run: `npm test -- src/utils/systemFlowConsistency.test.ts src/components/dashboard/AnalysisPanel.test.tsx src/components/dashboard/DashboardHeader.test.tsx src/pages/DashboardPage.test.tsx src/pages/AdminMobileLayoutRegression.test.ts`

Expected: PASS

- [ ] **Step 2: 跑构建**

Run: `npm run build`

Expected: `✓ built`

- [ ] **Step 3: 本地或线上手动复核流程**

```text
1. 打开 /dashboard
2. 让系统处于“分析中”
3. 等自动下注成功
4. 确认顶部预测区 / 工作流状态栏 / 智能分析面板同时进入“已下注等待开奖”
5. 点击开奖，确认 pending_bet 清空后重新回到“下一局分析中”
```

- [ ] **Step 4: 提交最终收口**

```bash
git add frontend/src
git commit -m "fix(frontend): harden dashboard workflow consistency"
```
