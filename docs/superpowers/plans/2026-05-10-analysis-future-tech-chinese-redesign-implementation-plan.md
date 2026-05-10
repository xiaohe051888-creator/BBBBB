# Analysis Future Tech Chinese Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把首页 `智能分析` 和详情抽屉重做成深色未来舱风格，并清理所有用户可见英文、内部术语和技术腔文案。

**Architecture:** 保持现有 `analysis_outcome` 契约和业务流程不变，只改前端展示层与文案层。先用测试锁住新的中文术语和交互入口，再补文案辅助函数，随后分别实现 `AnalysisPanel` 和 `AnalysisDetailDrawer` 的深色未来舱改版，最后跑前端测试、构建和诊断收尾。

**Tech Stack:** React, TypeScript, Ant Design, Vitest, Vite

---

## File Map

- Modify: `frontend/src/components/dashboard/AnalysisPanel.tsx`
  - 首页智能分析主卡，负责深色未来舱式结果卡、分析中状态、详情入口和中文化标签
- Modify: `frontend/src/components/dashboard/AnalysisPanel.test.tsx`
  - 锁住首页主卡的新中文术语、按钮文案、规则兜底文案和无英文要求
- Modify: `frontend/src/components/dashboard/AnalysisDetailDrawer.tsx`
  - 详情抽屉的深色未来舱样式、中文标题体系、补充说明、关闭按钮文案
- Modify: `frontend/src/components/dashboard/AnalysisDetailDrawer.test.tsx`
  - 锁住详情抽屉的新标题、术语替换、关闭按钮文案和补充说明区
- Modify: `frontend/src/utils/beginnerCopy.ts`
  - 统一输出首页状态文案、模式中文名、来源中文名、入口文案等
- Modify: `frontend/src/utils/i18nErrors.ts`
  - 提供面向用户的分析补充说明转写函数，避免英文错误原样暴露

---

### Task 1: 锁住新的中文术语与主卡文案

**Files:**
- Modify: `frontend/src/components/dashboard/AnalysisPanel.test.tsx`
- Modify: `frontend/src/utils/beginnerCopy.ts`

- [ ] **Step 1: 先把首页主卡测试改成新的未来科技中文预期**

```tsx
it('shows a future-style outcome card for intelligent analysis', async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <AnalysisPanel
        hasGameData
        hasPendingBet={false}
        aiAnalyzing={false}
        workflowStage={{
          type: 'analyzed_pending_bet',
          showAnalysisLoading: false,
          showCompletedAnalysis: true,
        }}
        analysis={{
          prediction: '庄',
          confidence: 0.83,
          combined_summary: '当前走势仍偏庄，本局建议继续跟庄。',
          prediction_mode: 'single_ai',
          analysis_outcome: {
            direction: '庄',
            confidence: 0.83,
            confidence_label: '高',
            source: 'single_ai',
            short_reason: '当前走势仍偏庄，本局建议继续跟庄。',
            final_reason: '大路和珠盘路都继续支持庄，所以本局先跟庄。',
            road_explanations: {},
          },
        }}
      />
    );
  });

  const html = container.innerHTML;
  expect(html).toContain('系统判断');
  expect(html).toContain('本局建议');
  expect(html).toContain('判断方式');
  expect(html).toContain('智能判断');
  expect(html).toContain('把握程度');
  expect(html).toContain('查看这次怎么判断的');
  expect(html).not.toContain('单AI判断');
  expect(html).not.toContain('AI');
  expect(html).not.toContain('single_ai');

  await act(async () => {
    root.unmount();
  });
  container.remove();
});
```

- [ ] **Step 2: 运行单测，确认先红**

Run: `cd /workspace/frontend && npm test -- src/components/dashboard/AnalysisPanel.test.tsx`

Expected: FAIL，旧组件仍输出 `单AI判断`、旧按钮文案或 `AI` 相关字样。

- [ ] **Step 3: 继续补一条规则兜底中文化测试**

```tsx
it('uses backup-judgement copy instead of technical fallback wording', async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <AnalysisPanel
        hasGameData
        hasPendingBet={false}
        aiAnalyzing={false}
        workflowStage={{
          type: 'analyzed_pending_bet',
          showAnalysisLoading: false,
          showCompletedAnalysis: true,
        }}
        analysis={{
          prediction: '庄',
          confidence: 0.61,
          combined_summary: '本次主判断等待时间过长，系统已自动启用备用判断。',
          prediction_mode: 'single_ai',
          analysis_outcome: {
            direction: '庄',
            confidence: 0.61,
            confidence_label: '中',
            source: 'rule_fallback',
            short_reason: '本次主判断等待时间过长，系统已自动启用备用判断。',
            final_reason: '五条路里三条继续支持庄，所以最终偏向庄。',
            fallback_reason: '本次主判断等待时间过长，系统已自动启用备用判断继续下注。',
            road_explanations: {},
          },
        }}
      />
    );
  });

  const html = container.innerHTML;
  expect(html).toContain('备用判断');
  expect(html).not.toContain('规则兜底');
  expect(html).not.toContain('上游接口调用失败');

  await act(async () => {
    root.unmount();
  });
  container.remove();
});
```

- [ ] **Step 4: 运行单测，确认第二条也先红**

Run: `cd /workspace/frontend && npm test -- src/components/dashboard/AnalysisPanel.test.tsx`

Expected: FAIL，说明旧术语和旧文案仍未被替换干净。

- [ ] **Step 5: 在文案辅助文件中补齐新术语函数**

```ts
export const formatAdminModeName = (mode: 'ai' | 'single_ai' | 'rule') => {
  if (mode === 'ai') return '多路综合判断';
  if (mode === 'single_ai') return '智能判断';
  return '规则辅助';
};

export const formatAnalysisLoadingText = (mode: 'ai' | 'single_ai' | 'rule') => {
  if (mode === 'ai') return '系统正在综合比对走势';
  if (mode === 'single_ai') return '系统正在智能判断';
  return '系统正在按内置规则计算';
};

export const formatAnalysisSourceLabel = (source?: 'single_ai' | 'rule_fallback') => {
  return source === 'rule_fallback' ? '备用判断' : '智能判断';
};

export const formatAnalysisEntryLabel = () => '查看这次怎么判断的';
export const formatConfidenceLabel = () => '把握程度';
```

- [ ] **Step 6: 运行单测，确认测试仍红但开始指向组件实现**

Run: `cd /workspace/frontend && npm test -- src/components/dashboard/AnalysisPanel.test.tsx`

Expected: FAIL，但失败应从“缺少函数/旧字样”收敛到 `AnalysisPanel.tsx` 还没切换新文案。

- [ ] **Step 7: 提交**

```bash
cd /workspace
git add frontend/src/components/dashboard/AnalysisPanel.test.tsx frontend/src/utils/beginnerCopy.ts
git commit -m "test: lock future-tech analysis panel copy"
```

---

### Task 2: 实现首页智能分析主卡的深色未来舱改版

**Files:**
- Modify: `frontend/src/components/dashboard/AnalysisPanel.tsx`
- Modify: `frontend/src/utils/beginnerCopy.ts`

- [ ] **Step 1: 先补首页组件会用到的局部辅助变量**

```tsx
const sourceLabel = formatAnalysisSourceLabel(outcome?.source);
const confidenceTitle = formatConfidenceLabel();
const detailEntryLabel = formatAnalysisEntryLabel();

const panelShellStyle: React.CSSProperties = {
  minHeight: 'auto',
  borderRadius: 18,
  background:
    'radial-gradient(circle at top left, rgba(37,99,235,0.32), transparent 34%), linear-gradient(135deg, #07111f 0%, #0b1730 52%, #091a2a 100%)',
  border: '1px solid rgba(96,165,250,0.24)',
  boxShadow: '0 18px 42px rgba(2, 6, 23, 0.42), inset 0 1px 0 rgba(148, 163, 184, 0.08)',
};

const capsuleStyle: React.CSSProperties = {
  borderRadius: 999,
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0.2,
};
```

- [ ] **Step 2: 把分析中状态切成纯中文未来舱文案**

```tsx
if (workflowStage.showAnalysisLoading || (aiAnalyzing && !hasPendingBet)) {
  return (
    <div className="analysis-card dashboard-section-card dashboard-analysis-card" style={panelShellStyle}>
      <div className="section-header">
        <span style={{ color: '#7dd3fc' }}><BulbOutlined /></span>
        <span className="section-title" style={{ color: '#e0f2fe' }}>智能分析</span>
        <div style={{ marginLeft: 'auto' }}>
          <Tag bordered={false} style={{ ...capsuleStyle, background: 'rgba(59,130,246,0.18)', color: '#bfdbfe' }}>
            {formatAdminModeName(mode)}
          </Tag>
        </div>
      </div>
      <div style={{ textAlign: 'center', padding: '28px 18px 30px' }}>
        <div style={{ fontSize: 28, marginBottom: 12, color: '#60a5fa', textShadow: '0 0 18px rgba(96,165,250,0.48)' }}>
          <RobotOutlined style={{ fontSize: 28 }} />
        </div>
        <div style={{ color: '#e0f2fe', fontSize: 18, fontWeight: 700 }}>系统正在综合比对走势</div>
        <div style={{ color: 'rgba(191,219,254,0.78)', fontSize: 13, marginTop: 10 }}>请稍候，判断结果马上出来</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 重写已得结论状态为深色智能决策面板**

```tsx
return (
  <div className="analysis-card dashboard-section-card dashboard-analysis-card" style={panelShellStyle}>
    <div className="section-header">
      <span style={{ color: '#7dd3fc' }}><BulbOutlined /></span>
      <span className="section-title" style={{ color: '#e0f2fe' }}>智能分析</span>
      <div style={{ marginLeft: 'auto' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: '#93c5fd',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 10px rgba(34,197,94,0.7)' }} />
          已完成判断
        </span>
      </div>
    </div>

    <div style={{ padding: 18, display: 'grid', gap: 14 }}>
      <div
        style={{
          padding: '16px 16px 18px',
          borderRadius: 16,
          background: 'linear-gradient(180deg, rgba(15,23,42,0.78) 0%, rgba(8,15,32,0.92) 100%)',
          border: '1px solid rgba(96,165,250,0.22)',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: '#93c5fd', letterSpacing: 0.6 }}>系统判断</div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginTop: 10 }}>
          <div>
            <div style={{ fontSize: 13, color: 'rgba(191,219,254,0.74)' }}>本局建议</div>
            <div style={{ marginTop: 6, fontSize: 64, lineHeight: 1, fontWeight: 900, color: getDirectionColor(direction), textShadow: `0 0 24px ${getDirectionColor(direction)}55` }}>
              {direction}
            </div>
          </div>
          <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
            <Tag bordered={false} style={{ ...capsuleStyle, background: 'rgba(14,116,144,0.24)', color: '#a5f3fc' }}>
              判断方式：{sourceLabel}
            </Tag>
            <Tag bordered={false} style={{ ...capsuleStyle, background: 'rgba(30,64,175,0.24)', color: '#bfdbfe' }}>
              {confidenceTitle}：{confidenceLabel}
            </Tag>
            <Tag bordered={false} style={{ ...capsuleStyle, background: 'rgba(15,23,42,0.66)', color: '#e2e8f0' }}>
              {confidencePercent}%
            </Tag>
          </div>
        </div>
      </div>

      <div
        style={{
          padding: '14px 16px',
          borderRadius: 16,
          background: 'rgba(8, 15, 32, 0.72)',
          border: '1px solid rgba(125,211,252,0.16)',
          color: '#e2e8f0',
          fontSize: 14,
          lineHeight: 1.75,
        }}
      >
        {summary}
      </div>

      {fallbackReason ? (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 14,
            background: 'rgba(8,47,73,0.76)',
            border: '1px solid rgba(34,211,238,0.24)',
            color: '#cffafe',
            fontSize: 13,
            lineHeight: 1.7,
          }}
        >
          {fallbackReason}
        </div>
      ) : null}

      <div>
        <Button type="primary" onClick={() => setDetailOpen(true)} style={{ borderRadius: 999, height: 42, paddingInline: 20 }}>
          {detailEntryLabel}
        </Button>
      </div>
    </div>
  </div>
);
```

- [ ] **Step 4: 调整空态和等待开奖态的中文文案**

```tsx
<div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: '#e2e8f0' }}>系统已准备好</div>
<div style={{ fontSize: 13, color: 'rgba(191,219,254,0.72)', maxWidth: 260, margin: '0 auto' }}>
  请先录入本靴结果，系统会自动开始判断
</div>
```

```tsx
<div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: '#bfdbfe' }}>本局已完成下注</div>
<div style={{ fontSize: 12, color: 'rgba(191,219,254,0.68)' }}>等待录入开奖结果</div>
```

- [ ] **Step 5: 运行首页单测，确认转绿**

Run: `cd /workspace/frontend && npm test -- src/components/dashboard/AnalysisPanel.test.tsx`

Expected: PASS

- [ ] **Step 6: 提交**

```bash
cd /workspace
git add frontend/src/components/dashboard/AnalysisPanel.tsx frontend/src/utils/beginnerCopy.ts
git commit -m "feat: redesign analysis panel with future-tech copy"
```

---

### Task 3: 锁住详情抽屉的新标题体系、补充说明和关闭文案

**Files:**
- Modify: `frontend/src/components/dashboard/AnalysisDetailDrawer.test.tsx`
- Modify: `frontend/src/utils/i18nErrors.ts`

- [ ] **Step 1: 把详情抽屉主测试改成新的中文术语**

```tsx
expect(html).toContain('智能分析详情');
expect(html).toContain('本局结论');
expect(html).toContain('五条路怎么看');
expect(html).toContain('这次判断来自哪里');
expect(html).toContain('判断方式');
expect(html).toContain('把握程度');
expect(html).toContain('备用判断');
expect(html).toContain('补充说明');
expect(html).not.toContain('规则兜底');
expect(html).not.toContain('判断来源');
expect(html).not.toContain('把握度');
expect(html).not.toContain('技术说明');
```

- [ ] **Step 2: 把正文关闭按钮测试改成新文案**

```tsx
const bodyCloseButton = Array.from(document.querySelectorAll('button')).find((button) =>
  button.textContent?.includes('看完了，回到主面板')
);
expect(bodyCloseButton).toBeTruthy();
```

- [ ] **Step 3: 运行详情抽屉单测，确认先红**

Run: `cd /workspace/frontend && npm test -- src/components/dashboard/AnalysisDetailDrawer.test.tsx`

Expected: FAIL，旧组件仍输出 `推理详情`、`规则兜底`、`技术说明` 或旧关闭按钮文案。

- [ ] **Step 4: 在错误转写工具中新增面向用户的补充说明函数**

```ts
export const toCnAnalysisDiagnostic = (raw?: string | null): string => {
  const text = String(raw || '').trim();
  const lower = text.toLowerCase();

  if (!text) {
    return '本次没有额外补充说明。';
  }
  if (lower.includes('analysis timeout')) {
    return '本次主判断等待时间过长，系统已自动改用备用判断继续下注。';
  }
  if (lower.includes('reveal')) {
    return '系统在处理本局结果时出现了短暂异常，随后已自动继续流程。';
  }
  return text.replace(/ai/gi, '智能判断');
};
```

- [ ] **Step 5: 运行详情抽屉单测，确认失败收敛到组件层**

Run: `cd /workspace/frontend && npm test -- src/components/dashboard/AnalysisDetailDrawer.test.tsx`

Expected: FAIL，但失败应主要集中在 `AnalysisDetailDrawer.tsx` 还没切换新标题和新文案。

- [ ] **Step 6: 提交**

```bash
cd /workspace
git add frontend/src/components/dashboard/AnalysisDetailDrawer.test.tsx frontend/src/utils/i18nErrors.ts
git commit -m "test: lock future-tech analysis detail copy"
```

---

### Task 4: 实现智能分析详情抽屉的深色未来舱改版

**Files:**
- Modify: `frontend/src/components/dashboard/AnalysisDetailDrawer.tsx`
- Modify: `frontend/src/utils/beginnerCopy.ts`
- Modify: `frontend/src/utils/i18nErrors.ts`

- [ ] **Step 1: 引入新的文案函数并改掉旧来源名称**

```tsx
import { formatAnalysisSourceLabel, formatConfidenceLabel } from '../../utils/beginnerCopy';
import { toCnAnalysisDiagnostic } from '../../utils/i18nErrors';

const getSourceLabel = (source: AnalysisOutcome['source']) => formatAnalysisSourceLabel(source);

const getSourceExplanation = (outcome: AnalysisOutcome) => {
  if (outcome.source === 'rule_fallback') {
    return '这次主判断没有及时返回稳定结果，系统已自动启用备用判断继续完成本局。';
  }

  return '这次结果由系统直接完成智能判断，并已按判断结果继续流程。';
};
```

- [ ] **Step 2: 把抽屉整体切成深色未来舱样式**

```tsx
const shellStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
  maxWidth: 880,
  margin: '0 auto',
  paddingBottom: 28,
};

const sectionCardStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 18,
  border: '1px solid rgba(96,165,250,0.18)',
  background: 'linear-gradient(180deg, rgba(11,23,48,0.9) 0%, rgba(7,17,31,0.96) 100%)',
  boxShadow: '0 16px 34px rgba(2, 6, 23, 0.34)',
};

const sectionHeadingStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 17,
  lineHeight: 1.35,
  fontWeight: 800,
  color: '#e0f2fe',
};

const bodyTextStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.85,
  color: '#dbeafe',
};
```

- [ ] **Step 3: 修改抽屉标题和第一屏总览文案**

```tsx
<Drawer
  open={open}
  onClose={handleClose}
  title="智能分析详情"
  placement="bottom"
  size="large"
  destroyOnClose
  extra={
    <Button type="text" onClick={handleClose} style={{ fontWeight: 700, color: '#bfdbfe' }}>
      收起详情
    </Button>
  }
  styles={{
    header: {
      background: '#07111f',
      borderBottom: '1px solid rgba(96,165,250,0.18)',
      color: '#e0f2fe',
    },
    body: {
      padding: 14,
      background:
        'radial-gradient(circle at top left, rgba(37,99,235,0.22), transparent 28%), linear-gradient(180deg, #020617 0%, #07111f 100%)',
    },
  }}
>
```

```tsx
<section style={sectionCardStyle}>
  <h3 style={sectionHeadingStyle}>本局结论</h3>
  <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#93c5fd' }}>判断方式</span>
      <Tag bordered={false} color="processing">{getSourceLabel(outcome.source)}</Tag>
    </div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#93c5fd' }}>{formatConfidenceLabel()}</span>
      <Tag bordered={false} color="blue">{outcome.confidence_label}</Tag>
      <Tag bordered={false}>{Math.round(outcome.confidence * 100)}%</Tag>
    </div>
  </div>
  <p style={{ margin: '14px 0 10px', fontSize: 30, lineHeight: 1.2, fontWeight: 900, color: '#f8fafc' }}>
    本局建议：{outcome.direction}
  </p>
  <p style={{ ...bodyTextStyle, padding: '12px 14px', borderRadius: 14, background: 'rgba(8,15,32,0.75)', border: '1px solid rgba(125,211,252,0.12)' }}>
    {outcome.short_reason}
  </p>
</section>
```

- [ ] **Step 4: 把来源说明和补充说明改成新标题体系**

```tsx
<section style={sectionCardStyle}>
  <h3 style={sectionHeadingStyle}>这次判断来自哪里</h3>
  <p style={{ ...bodyTextStyle, marginTop: 12, color: '#bfdbfe' }}>
    {getSourceExplanation(outcome)}
  </p>
</section>

{outcome.technical_diagnostic?.message ? (
  <section
    style={{
      ...sectionCardStyle,
      background: 'linear-gradient(180deg, rgba(15,23,42,0.72) 0%, rgba(8,15,32,0.9) 100%)',
      border: '1px solid rgba(148,163,184,0.16)',
      boxShadow: 'none',
    }}
  >
    <Collapse
      ghost
      items={[
        {
          key: 'technical-diagnostic',
          label: '补充说明',
          children: (
            <p style={{ ...bodyTextStyle, color: '#cbd5e1' }}>
              {toCnAnalysisDiagnostic(outcome.technical_diagnostic.message)}
            </p>
          ),
        },
      ]}
    />
  </section>
) : null}
```

- [ ] **Step 5: 更新底部关闭按钮文案**

```tsx
<Button type="primary" size="large" block onClick={handleClose}>
  看完了，回到主面板
</Button>
```

- [ ] **Step 6: 运行详情抽屉单测，确认转绿**

Run: `cd /workspace/frontend && npm test -- src/components/dashboard/AnalysisDetailDrawer.test.tsx`

Expected: PASS

- [ ] **Step 7: 提交**

```bash
cd /workspace
git add frontend/src/components/dashboard/AnalysisDetailDrawer.tsx frontend/src/utils/beginnerCopy.ts frontend/src/utils/i18nErrors.ts
git commit -m "feat: redesign analysis detail drawer with future-tech copy"
```

---

### Task 5: 前端回归、构建与诊断收尾

**Files:**
- Test: `frontend/src/components/dashboard/AnalysisPanel.test.tsx`
- Test: `frontend/src/components/dashboard/AnalysisDetailDrawer.test.tsx`
- Check: `frontend/src/components/dashboard/AnalysisPanel.tsx`
- Check: `frontend/src/components/dashboard/AnalysisDetailDrawer.tsx`
- Check: `frontend/src/utils/beginnerCopy.ts`
- Check: `frontend/src/utils/i18nErrors.ts`

- [ ] **Step 1: 跑两个目标单测**

Run: `cd /workspace/frontend && npm test -- src/components/dashboard/AnalysisPanel.test.tsx src/components/dashboard/AnalysisDetailDrawer.test.tsx`

Expected: PASS

- [ ] **Step 2: 跑前端构建**

Run: `cd /workspace/frontend && npm run build`

Expected: PASS

- [ ] **Step 3: 检查新增诊断**

Check diagnostics for:
- `frontend/src/components/dashboard/AnalysisPanel.tsx`
- `frontend/src/components/dashboard/AnalysisDetailDrawer.tsx`
- `frontend/src/utils/beginnerCopy.ts`
- `frontend/src/utils/i18nErrors.ts`

Expected: 无新增明显报错

- [ ] **Step 4: 搜索前端用户可见残留词**

Run: `rg -n "单AI判断|规则兜底|推理详情|技术说明|我知道了，收起详情|analysis timeout after 45.00s" /workspace/frontend/src/components/dashboard /workspace/frontend/src/utils`

Expected: 搜索结果只剩测试数据注释或无用户可见残留；若仍命中实际界面文案，继续修正

- [ ] **Step 5: 提交最终实现**

```bash
cd /workspace
git add \
  frontend/src/components/dashboard/AnalysisPanel.tsx \
  frontend/src/components/dashboard/AnalysisPanel.test.tsx \
  frontend/src/components/dashboard/AnalysisDetailDrawer.tsx \
  frontend/src/components/dashboard/AnalysisDetailDrawer.test.tsx \
  frontend/src/utils/beginnerCopy.ts \
  frontend/src/utils/i18nErrors.ts \
  docs/superpowers/specs/2026-05-10-analysis-future-tech-chinese-redesign-design.md \
  docs/superpowers/plans/2026-05-10-analysis-future-tech-chinese-redesign-implementation-plan.md
git commit -m "feat: redesign analysis surfaces with future-tech chinese copy"
```
