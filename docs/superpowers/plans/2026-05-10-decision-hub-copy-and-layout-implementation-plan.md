# Decision Hub Copy And Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the analysis card, embedded analysis detail drawer, and log detail modal into a more polished “decision hub” UI with more premium system wording and cleaner mobile-first layout.

**Architecture:** Keep business logic unchanged and focus only on presentation-layer copy and structure. First lock the new decision-hub terminology in shared copy helpers and log humanization, then refactor `AnalysisPanel` and `LogsPage` to use the new wording and more orderly spacing/alignment, and finally verify the exact UI text and layout entry points with focused Vitest coverage.

**Tech Stack:** React, TypeScript, Ant Design, Vitest, React Query

---

## File Map

- Modify: `frontend/src/utils/beginnerCopy.ts`
  - Owns shared UI labels for detail sections and log/detail button text
- Modify: `frontend/src/utils/beginnerCopy.test.ts`
  - Locks shared copy terminology changes
- Modify: `frontend/src/utils/logHumanizer.ts`
  - Owns record-detail humanized titles, section copy, and copy-summary text
- Modify: `frontend/src/utils/logHumanizer.test.ts`
  - Locks decision-hub wording for log summaries
- Modify: `frontend/src/components/dashboard/AnalysisPanel.tsx`
  - Owns analysis card result state and embedded detail `Drawer`
- Modify: `frontend/src/components/dashboard/AnalysisPanel.test.tsx`
  - Locks analysis card terminology and detail entry wording
- Modify: `frontend/src/pages/LogsPage.tsx`
  - Owns record detail modal layout and action labels
- Modify: `frontend/src/pages/LogsPage.test.tsx`
  - Locks record-detail surface wording and modal actions
- Create: `docs/superpowers/plans/2026-05-10-decision-hub-copy-and-layout-implementation-plan.md`

## Task 1: Lock Decision-Hub Terminology In Shared Copy

**Files:**
- Modify: `frontend/src/utils/beginnerCopy.test.ts`
- Modify: `frontend/src/utils/logHumanizer.test.ts`
- Test: `frontend/src/utils/beginnerCopy.test.ts`
- Test: `frontend/src/utils/logHumanizer.test.ts`

- [ ] **Step 1: Write the failing shared-copy assertions**

Add this block near the existing `formats detail labels in plain language` test in `frontend/src/utils/beginnerCopy.test.ts`:

```ts
  it('formats detail labels in decision-hub language', () => {
    expect(formatDetailLabel('copyHint')).toBe('可复制本条摘要，用于转发或留存');
    expect(formatDetailLabel('whatHappened')).toBe('变动');
    expect(formatDetailLabel('impact')).toBe('影响');
    expect(formatDetailLabel('suggestion')).toBe('状态');
    expect(formatDetailLabel('keyInfo')).toBe('关键信息');
    expect(formatDetailLabel('rawData')).toBe('系统记录');
    expect(formatDetailLabel('copySummary')).toBe('复制摘要');
  });
```

Add this block near the first test in `frontend/src/utils/logHumanizer.test.ts`:

```ts
  it('uses decision-hub summary wording in copied text', () => {
    const log: LogEntry = {
      id: 10,
      log_time: '2026-05-02T00:00:00Z',
      game_number: 25,
      event_code: 'LOG-BET-001',
      event_type: '下注',
      event_result: '成功',
      description: '第25局下注庄3030元。',
      category: '资金事件',
      priority: 'P2',
      task_id: null,
      is_pinned: false,
    };

    const text = toHumanCopyText(log);
    expect(text).toContain('变动');
    expect(text).toContain('影响');
    expect(text).toContain('状态');
    expect(text).not.toContain('这次发生了什么');
    expect(text).not.toContain('建议你接下来怎么做');
  });
```

- [ ] **Step 2: Run the shared-copy tests and confirm they fail**

Run:

```bash
npm test -- src/utils/beginnerCopy.test.ts src/utils/logHumanizer.test.ts
```

Expected:

```text
FAIL ... formats detail labels in decision-hub language
FAIL ... uses decision-hub summary wording in copied text
```

- [ ] **Step 3: Implement the new decision-hub labels**

Update `frontend/src/utils/beginnerCopy.ts`:

```ts
  if (key === 'copyHint') return '可复制本条摘要，用于转发或留存';
  if (key === 'copySummary') return '复制摘要';
  if (key === 'whatHappened') return '变动';
  if (key === 'impact') return '影响';
  if (key === 'suggestion') return '状态';
  if (key === 'keyInfo') return '关键信息';
  if (key === 'rawData') return '系统记录';
```

Update `frontend/src/utils/logHumanizer.ts` so `toHumanCopyText()` outputs the same section titles:

```ts
export const toHumanCopyText = (log: LogEntry): string => {
  const h = humanizeLog(log);
  return [
    `标题：${h.title}`,
    `变动：${h.whatHappened}`,
    `影响：${h.impact}`,
    `状态：${h.suggestion}`,
  ].join('\n');
};
```

- [ ] **Step 4: Re-run the shared-copy tests and confirm they pass**

Run:

```bash
npm test -- src/utils/beginnerCopy.test.ts src/utils/logHumanizer.test.ts
```

Expected:

```text
PASS src/utils/beginnerCopy.test.ts
PASS src/utils/logHumanizer.test.ts
```

- [ ] **Step 5: Commit the shared terminology change**

```bash
git add frontend/src/utils/beginnerCopy.ts frontend/src/utils/beginnerCopy.test.ts frontend/src/utils/logHumanizer.ts frontend/src/utils/logHumanizer.test.ts
git commit -m "refactor: adopt decision hub terminology"
```

## Task 2: Redesign The Analysis Card And Embedded Detail Drawer

**Files:**
- Modify: `frontend/src/components/dashboard/AnalysisPanel.test.tsx`
- Modify: `frontend/src/components/dashboard/AnalysisPanel.tsx`
- Test: `frontend/src/components/dashboard/AnalysisPanel.test.tsx`

- [ ] **Step 1: Add failing UI assertions for the decision-hub analysis surface**

Append this new test in `frontend/src/components/dashboard/AnalysisPanel.test.tsx`:

```tsx
  it('shows decision-hub wording for result state and detail entry', async () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AnalysisPanel
          hasGameData
          aiAnalyzing={false}
          analysis={{
            prediction: '庄',
            confidence: 0.82,
            bet_tier: '标准',
            combined_summary: '下三路与大路共振偏庄。',
            reasoning_points: ['大路延续庄势', '珠盘路同步偏庄'],
            reasoning_detail: '当前多路信号保持共振，系统维持庄方向决断。',
            prediction_mode: 'single_ai',
          }}
        />,
      );
    });

    const html = container.innerHTML;

    expect(html).toContain('已完成研判');
    expect(html).toContain('本局决断');
    expect(html).toContain('决策机制');
    expect(html).toContain('决断强度');
    expect(html).toContain('展开决断详情');
    expect(html).not.toContain('查看推理详情');
    expect(html).not.toContain('把握度');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
```

- [ ] **Step 2: Run the analysis panel test and confirm it fails**

Run:

```bash
npm test -- src/components/dashboard/AnalysisPanel.test.tsx
```

Expected:

```text
FAIL ... shows decision-hub wording for result state and detail entry
```

- [ ] **Step 3: Refactor `AnalysisPanel.tsx` to the new copy and cleaner layout**

Make these concrete edits in `frontend/src/components/dashboard/AnalysisPanel.tsx`:

1. Add small local labels near the result-state section:

```tsx
  const decisionLabel = '本局决断';
  const decisionMethodLabel = '决策机制';
  const decisionStrengthLabel = '决断强度';
  const detailEntryLabel = '展开决断详情';
```

2. Replace the result-state top-right status chip text:

```tsx
<Tag color="success" style={{ borderRadius: 999, fontWeight: 700 }}>
  已完成研判
</Tag>
```

3. Replace the current crowded result header with a two-column summary block:

```tsx
<div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 16, alignItems: 'center' }}>
  <div>
    <div style={{ fontSize: 12, letterSpacing: 1.2, color: 'rgba(191,219,254,0.72)', marginBottom: 8 }}>
      {decisionLabel}
    </div>
    <div style={{ fontSize: 72, lineHeight: 1, fontWeight: 800, color: analysis.prediction === '庄' ? '#ff8a8a' : '#7cc8ff' }}>
      {analysis.prediction || '-'}
    </div>
  </div>
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 120 }}>
    <Tag bordered={false} style={{ borderRadius: 999, minWidth: 112, textAlign: 'center' }}>
      {decisionMethodLabel}：{mode === 'rule' ? '规则推演' : '智能研判'}
    </Tag>
    <Tag bordered={false} style={{ borderRadius: 999, minWidth: 112, textAlign: 'center' }}>
      {decisionStrengthLabel}：{((analysis.confidence || 0) * 100).toFixed(0)}%
    </Tag>
  </div>
</div>
```

4. Replace button text and reasoning section labels:

```tsx
<span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>决断要点</span>
...
<Button size="small" type="link" style={{ padding: 0, height: 'auto' }} onClick={() => setDetailOpen(true)}>
  {detailEntryLabel}
</Button>
```

5. Replace the drawer title/body/footer treatment:

```tsx
<Drawer
  title="智能分析详情"
  extra={
    <Button type="text" onClick={() => setDetailOpen(false)}>
      收起
    </Button>
  }
  ...
>
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div style={{ borderRadius: 20, padding: 20, background: 'linear-gradient(180deg, rgba(11,22,54,0.92), rgba(7,16,37,0.88))', border: '1px solid rgba(96,165,250,0.18)' }}>
      <div style={{ fontSize: 12, color: 'rgba(191,219,254,0.72)', marginBottom: 8 }}>本局决断</div>
      <div style={{ fontSize: 48, fontWeight: 800, marginBottom: 12 }}>{analysis?.prediction || '-'}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Tag bordered={false}>{decisionMethodLabel}：{mode === 'rule' ? '规则推演' : '智能研判'}</Tag>
        <Tag bordered={false}>{decisionStrengthLabel}：{((analysis?.confidence || 0) * 100).toFixed(0)}%</Tag>
      </div>
    </div>
    <div>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>最终决断依据</div>
      <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.85, fontSize: 14, color: 'rgba(255,255,255,0.78)' }}>
        {reasoningDetail || '当前暂无决断依据。'}
      </div>
    </div>
    <Button type="primary" size="large" block onClick={() => setDetailOpen(false)}>
      返回
    </Button>
  </div>
</Drawer>
```

- [ ] **Step 4: Re-run the analysis panel test and verify it passes**

Run:

```bash
npm test -- src/components/dashboard/AnalysisPanel.test.tsx
```

Expected:

```text
PASS src/components/dashboard/AnalysisPanel.test.tsx
```

- [ ] **Step 5: Commit the analysis card + drawer refactor**

```bash
git add frontend/src/components/dashboard/AnalysisPanel.tsx frontend/src/components/dashboard/AnalysisPanel.test.tsx
git commit -m "refactor: upgrade analysis panel to decision hub layout"
```

## Task 3: Upgrade The Log Detail Modal To Match The Decision Hub

**Files:**
- Modify: `frontend/src/pages/LogsPage.test.tsx`
- Modify: `frontend/src/pages/LogsPage.tsx`
- Test: `frontend/src/pages/LogsPage.test.tsx`

- [ ] **Step 1: Add a failing modal wording test**

Add this new test below the existing log-filter hydration test in `frontend/src/pages/LogsPage.test.tsx`:

```tsx
  it('uses decision-hub wording in the detail modal footer and sections', async () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: () => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
    Object.defineProperty(window, 'getComputedStyle', {
      writable: true,
      value: () => ({ getPropertyValue: () => '' }),
    });

    useLogsQueryMock.mockReturnValue({
      data: {
        logs: [
          {
            id: 1,
            log_time: '2026-05-02T00:00:00Z',
            game_number: 25,
            event_code: 'LOG-BET-001',
            event_type: '下注',
            event_result: '成功',
            description: '系统已经按当前判断完成下注，第25局押庄3030元。',
            category: '资金事件',
            priority: 'P2',
            task_id: null,
            is_pinned: false,
          },
        ],
        total: 1,
      },
      refetch: vi.fn(),
      isFetching: false,
      error: null,
    });

    const queryClient = new QueryClient();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <App>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={['/dashboard/logs']}>
              <LogsPage />
            </MemoryRouter>
          </QueryClientProvider>
        </App>,
      );
    });

    await act(async () => {
      document.querySelector('tbody tr')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const html = document.body.innerHTML;
    expect(html).toContain('复制摘要');
    expect(html).toContain('变动');
    expect(html).toContain('影响');
    expect(html).toContain('状态');
    expect(html).toContain('系统记录');
    expect(html).not.toContain('复制通俗说明');
    expect(html).not.toContain('这次发生了什么');
    expect(html).not.toContain('建议你接下来怎么做');

    await act(async () => {
      root.unmount();
    });
    queryClient.clear();
    container.remove();
  });
```

- [ ] **Step 2: Run the log page test and confirm it fails**

Run:

```bash
npm test -- src/pages/LogsPage.test.tsx
```

Expected:

```text
FAIL ... uses decision-hub wording in the detail modal footer and sections
```

- [ ] **Step 3: Refactor the modal wording and spacing in `LogsPage.tsx`**

Apply these concrete edits in `frontend/src/pages/LogsPage.tsx`:

1. Replace footer action text:

```tsx
footer={[
  <Button key="select" disabled={!log} onClick={selectHumanText}>
    全选
  </Button>,
  <Button key="copy" disabled={!log} onClick={() => copy(humanText)}>
    {formatDetailLabel('copySummary')}
  </Button>,
  <Button key="close" type="primary" onClick={onClose}>
    返回
  </Button>,
]}
```

2. Increase vertical rhythm and add clearer section cards:

```tsx
<div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
```

3. Wrap the three main text sections in a shared card style:

```tsx
const detailSectionStyle: React.CSSProperties = {
  borderRadius: 18,
  padding: '16px 18px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'linear-gradient(180deg, rgba(12,20,43,0.9), rgba(8,14,31,0.88))',
};
```

Then render:

```tsx
<div style={detailSectionStyle}>
  <Typography.Text type="secondary">{formatDetailLabel('whatHappened')}</Typography.Text>
  <Typography.Paragraph style={{ margin: '10px 0 0' }}>{human.whatHappened || '-'}</Typography.Paragraph>
</div>
<div style={detailSectionStyle}>
  <Typography.Text type="secondary">{formatDetailLabel('impact')}</Typography.Text>
  <Typography.Paragraph style={{ margin: '10px 0 0' }}>{human.impact || '-'}</Typography.Paragraph>
</div>
<div style={detailSectionStyle}>
  <Typography.Text type="secondary">{formatDetailLabel('suggestion')}</Typography.Text>
  <Typography.Paragraph style={{ margin: '10px 0 0' }}>{human.suggestion || '-'}</Typography.Paragraph>
</div>
```

4. Rename the collapse label by relying on the new shared copy key:

```tsx
label: formatDetailLabel('rawData')
```

- [ ] **Step 4: Re-run the log page test and confirm it passes**

Run:

```bash
npm test -- src/pages/LogsPage.test.tsx
```

Expected:

```text
PASS src/pages/LogsPage.test.tsx
```

- [ ] **Step 5: Commit the record detail modal upgrade**

```bash
git add frontend/src/pages/LogsPage.tsx frontend/src/pages/LogsPage.test.tsx
git commit -m "refactor: polish log detail modal as decision hub"
```

## Task 4: Final Regression And Delivery

**Files:**
- Modify: `frontend/src/components/dashboard/AnalysisPanel.tsx`
- Modify: `frontend/src/pages/LogsPage.tsx`
- Modify: `frontend/src/utils/beginnerCopy.ts`
- Modify: `frontend/src/utils/logHumanizer.ts`
- Modify: related `*.test.ts(x)` files

- [ ] **Step 1: Run the focused regression suite**

Run:

```bash
npm test -- \
  src/utils/beginnerCopy.test.ts \
  src/utils/logHumanizer.test.ts \
  src/components/dashboard/AnalysisPanel.test.tsx \
  src/pages/LogsPage.test.tsx
```

Expected:

```text
all selected frontend tests pass
```

- [ ] **Step 2: Run a production build**

Run:

```bash
npm run build
```

Expected:

```text
vite build completes successfully
```

- [ ] **Step 3: Inspect the final diff**

Run:

```bash
git diff --stat HEAD~3..HEAD
```

Expected:

```text
analysis panel, logs page, copy helpers, and tests only
```

- [ ] **Step 4: Commit any final polish and push**

```bash
git push origin main
```

Expected:

```text
main pushed successfully
```

- [ ] **Step 5: Verify production surfaces are reachable**

Run:

```bash
python - <<'PY'
import urllib.request
print(urllib.request.urlopen("https://bbbbb-frontend.onrender.com", timeout=20).status)
print(urllib.request.urlopen("https://bbbbb-backend.onrender.com/api/system/ping", timeout=20).read().decode())
PY
```

Expected:

```text
200
{"ok":true}
```
