# Log Display Full Chinese Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把运行记录页面所有用户可见日志改成普通用户能看懂的中文表达，同时不改后端日志写入和核心工作流。

**Architecture:** 保持后端日志原始数据不变，只改前端展示链路。先用 `logHumanizer` 与 `LogsPage` 测试锁住关键日志的中文目标，再扩展 `i18nErrors` 的日志专用转写，随后落地到详情弹窗与高级信息区，最后做日志页面、工具函数和构建回归。

**Tech Stack:** React, TypeScript, Ant Design, Vitest, Vite

---

## File Map

- Modify: `frontend/src/utils/logHumanizer.ts`
  - 日志标题、人话说明、高级信息字段值的中文化中心
- Modify: `frontend/src/utils/logHumanizer.test.ts`
  - 锁住 `LOG-MDL-001 / LOG-MDL-003 / LOG-BET-001` 等关键日志的中文输出
- Modify: `frontend/src/utils/i18nErrors.ts`
  - 统一英文异常、内部模式词和失败原因的中文转写
- Modify: `frontend/src/utils/i18nErrors.test.ts`
  - 锁住日志专用转写函数
- Modify: `frontend/src/utils/beginnerCopy.ts`
  - 统一日志页按钮、标题和高级信息区域名称
- Modify: `frontend/src/pages/LogsPage.tsx`
  - 详情弹窗和高级信息区改用中文化内容
- Modify: `frontend/src/pages/LogsPage.test.tsx`
  - 锁住详情弹窗中的新中文文案

---

### Task 1: 锁住关键日志的人话输出目标

**Files:**
- Modify: `frontend/src/utils/logHumanizer.test.ts`
- Modify: `frontend/src/pages/LogsPage.test.tsx`

- [ ] **Step 1: 在 `logHumanizer.test.ts` 新增 `LOG-MDL-003` 的失败测试**

```tsx
it('rewrites LOG-MDL-003 into beginner-friendly Chinese without raw timeout text', () => {
  const log: LogEntry = {
    id: 20,
    log_time: '2026-05-10T04:38:55Z',
    game_number: 23,
    event_code: 'LOG-MDL-003',
    event_type: '规则兜底接管',
    event_result: '成功',
    description: '单AI失败后已切换规则兜底继续下注：上传触发分析时发生系统错误: analysis timeout after 45.00s',
    category: '工作流事件',
    priority: 'P1',
    task_id: 'task-23',
    is_pinned: false,
  };

  const h = humanizeLog(log);
  expect(h.title).toBe('智能分析：系统已自动改用备用判断');
  expect(h.whatHappened).toBe('智能判断这次没有及时给出稳定结果，系统已经自动改用备用判断继续完成下注。');
  expect(h.impact).toBe('这次不会中断本局流程，系统已经继续给出最终下注决定。');
  expect(h.suggestion).toBe('无需操作，等待本局开奖结果即可。');
  expect(h.whatHappened).not.toContain('analysis timeout');
  expect(h.whatHappened).not.toContain('单AI');
  expect(h.whatHappened).not.toContain('规则兜底');
});
```

- [ ] **Step 2: 补一条 `LOG-MDL-001` 的失败测试**

```tsx
it('rewrites LOG-MDL-001 into a Chinese judgement summary', () => {
  const log: LogEntry = {
    id: 21,
    log_time: '2026-05-10T04:28:06Z',
    game_number: 23,
    event_code: 'LOG-MDL-001',
    event_type: 'AI分析',
    event_result: '完成',
    description: '🧠 AI对第23局推理完成：预测【庄】 (置信度: 55%)',
    category: 'AI事件',
    priority: 'P2',
    task_id: 'task-24',
    is_pinned: false,
  };

  const h = humanizeLog(log);
  expect(h.title).toBe('智能分析：第23局判断已完成');
  expect(h.whatHappened).toBe('系统已经完成第23局判断，当前建议押庄。');
  expect(h.whatHappened).not.toContain('AI对第23局推理完成');
  expect(h.whatHappened).not.toContain('🧠');
});
```

- [ ] **Step 3: 补一条 `LOG-BET-001` 的失败测试**

```tsx
it('rewrites LOG-BET-001 into a plain Chinese betting summary', () => {
  const log: LogEntry = {
    id: 22,
    log_time: '2026-05-10T04:38:55Z',
    game_number: 23,
    event_code: 'LOG-BET-001',
    event_type: '下注',
    event_result: '已下注庄2500.00元',
    description: '第23局下注庄2500.00元（高档），余额13074.00→10574.00',
    category: '资金事件',
    priority: 'P2',
    task_id: 'task-25',
    is_pinned: false,
  };

  const h = humanizeLog(log);
  expect(h.whatHappened).toBe('系统已经按当前判断完成下注，第23局押庄 2500 元。');
});
```

- [ ] **Step 4: 把 `LogsPage.test.tsx` 里的详情弹窗测试改成锁住新中文**

```tsx
expect(modalText).toContain('记录详情');
expect(modalText).toContain('系统原始记录（高级信息）');
expect(modalText).toContain('这次发生了什么');
expect(modalText).toContain('对当前使用有什么影响');
expect(modalText).toContain('建议你接下来怎么做');
expect(modalText).not.toContain('analysis timeout after 45.00s');
expect(modalText).not.toContain('LOG-MDL-003');
expect(modalText).not.toContain('单AI');
expect(modalText).not.toContain('规则兜底');
```

- [ ] **Step 5: 运行测试，确认先红**

Run: `cd /workspace/frontend && npm test -- src/utils/logHumanizer.test.ts src/pages/LogsPage.test.tsx`

Expected: FAIL，失败点集中在 `logHumanizer.ts` 仍输出原始说明，`LogsPage.tsx` 仍展示旧高级信息标题或透出英文原文。

- [ ] **Step 6: 提交**

```bash
cd /workspace
git add frontend/src/utils/logHumanizer.test.ts frontend/src/pages/LogsPage.test.tsx
git commit -m "test: lock full chinese log display copy"
```

---

### Task 2: 扩展日志专用中文转写函数

**Files:**
- Modify: `frontend/src/utils/i18nErrors.ts`
- Modify: `frontend/src/utils/i18nErrors.test.ts`

- [ ] **Step 1: 在 `i18nErrors.test.ts` 新增日志专用转写失败测试**

```tsx
it('translates upload-triggered analysis timeout into plain Chinese', () => {
  expect(
    toCnLogDetailText('上传触发分析时发生系统错误: analysis timeout after 45.00s'),
  ).toBe('上传后开始智能判断时等待时间过长，因此系统自动改用了备用判断。');
});

it('translates rule fallback wording into backup-judgement Chinese', () => {
  expect(
    toCnLogDetailText('单AI失败后已切换规则兜底继续下注'),
  ).toBe('智能判断这次没有及时给出稳定结果，系统已经自动改用备用判断继续完成下注。');
});
```

- [ ] **Step 2: 运行测试，确认先红**

Run: `cd /workspace/frontend && npm test -- src/utils/i18nErrors.test.ts`

Expected: FAIL，因为 `toCnLogDetailText()` 还不存在或现有 `toCnAnalysisDiagnostic()` 不满足日志场景。

- [ ] **Step 3: 在 `i18nErrors.ts` 新增日志专用转写入口**

```ts
export const toCnLogDetailText = (raw?: string | null): string => {
  const s = String(raw || '').trim();
  const lower = s.toLowerCase();

  if (!s) return '';

  if (
    lower.includes('上传触发分析时发生系统错误') &&
    lower.includes('analysis timeout after 45.00s')
  ) {
    return '上传后开始智能判断时等待时间过长，因此系统自动改用了备用判断。';
  }

  if (
    s.includes('单AI失败后已切换规则兜底继续下注') ||
    lower.includes('rule_fallback') ||
    lower.includes('fallback to rule')
  ) {
    return '智能判断这次没有及时给出稳定结果，系统已经自动改用备用判断继续完成下注。';
  }

  if (lower.includes('analysis timeout after 45.00s') || lower.includes('timeout')) {
    return '智能判断等待时间过长。';
  }

  return s
    .replace(/single_ai/gi, '智能判断')
    .replace(/rule_fallback/gi, '备用判断')
    .replace(/fallback/gi, '备用判断')
    .replace(/reveal/gi, '录入开奖结果');
};
```

- [ ] **Step 4: 运行测试，确认转绿**

Run: `cd /workspace/frontend && npm test -- src/utils/i18nErrors.test.ts`

Expected: PASS

- [ ] **Step 5: 提交**

```bash
cd /workspace
git add frontend/src/utils/i18nErrors.ts frontend/src/utils/i18nErrors.test.ts
git commit -m "feat: add chinese log detail translation rules"
```

---

### Task 3: 重做 logHumanizer 的关键日志规则

**Files:**
- Modify: `frontend/src/utils/logHumanizer.ts`
- Modify: `frontend/src/utils/logHumanizer.test.ts`

- [ ] **Step 1: 在 `logHumanizer.ts` 引入日志专用转写函数**

```ts
import { toCnLogDetailText } from './i18nErrors';
```

- [ ] **Step 2: 改写 `LOG-MDL-001`、`LOG-MDL-003`、`LOG-BET-001` 的规则**

```ts
'LOG-MDL-001': (log) => ({
  title: `智能分析：第${log.game_number ?? '-'}局判断已完成`,
  whatHappened: `系统已经完成第${log.game_number ?? '-'}局判断，当前建议押${s(log.description).includes('【闲】') ? '闲' : '庄'}。`,
  impact: '系统会按这次判断继续决定下注方向和金额。',
  suggestion: '无需操作，等待系统继续完成下注即可。',
}),
'LOG-MDL-003': (log) => ({
  title: '智能分析：系统已自动改用备用判断',
  whatHappened: '智能判断这次没有及时给出稳定结果，系统已经自动改用备用判断继续完成下注。',
  impact: '这次不会中断本局流程，系统已经继续给出最终下注决定。',
  suggestion: '无需操作，等待本局开奖结果即可。',
}),
'LOG-BET-001': (log) => ({
  title: `下注：第${log.game_number ?? '-'}局已完成`,
  whatHappened: `系统已经按当前判断完成下注，第${log.game_number ?? '-'}局押${s(log.description).includes('下注闲') ? '闲' : '庄'} ${s(log.description).match(/下注[庄闲](\\d+(?:\\.\\d+)?)/)?.[1] || '-'} 元。`,
  impact: '余额已经按这次下注同步更新。',
  suggestion: '等待开奖结果即可。',
}),
```

- [ ] **Step 3: 让通用字段值也尽量中文化**

```ts
const baseFields = (log: LogEntry): HumanLogField[] => [
  { label: '时间', value: log.log_time ? formatBeijing(String(log.log_time), 'YYYY-MM-DD HH:mm:ss') : '-' },
  { label: '靴内局号', value: log.game_number === null ? '-' : String(log.game_number) },
  { label: '事件', value: s(log.event_type) || '-' },
  { label: '结果', value: s(log.event_result) || '-' },
  { label: '类别', value: s(log.category) || '-' },
  { label: '严重程度', value: priorityCn(s(log.priority)) },
  { label: '事件编码', value: '系统内部识别码' },
  { label: '处理编号', value: log.task_id ? '本次系统处理编号' : '-' },
  { label: '原始说明', value: toCnLogDetailText(log.description) || '-' },
];
```

- [ ] **Step 4: 运行测试，确认转绿**

Run: `cd /workspace/frontend && npm test -- src/utils/logHumanizer.test.ts`

Expected: PASS

- [ ] **Step 5: 提交**

```bash
cd /workspace
git add frontend/src/utils/logHumanizer.ts frontend/src/utils/logHumanizer.test.ts
git commit -m "feat: humanize visible log content into chinese"
```

---

### Task 4: 更新日志详情弹窗和页面文案

**Files:**
- Modify: `frontend/src/pages/LogsPage.tsx`
- Modify: `frontend/src/pages/LogsPage.test.tsx`
- Modify: `frontend/src/utils/beginnerCopy.ts`

- [ ] **Step 1: 把高级信息区标题改成新文案**

```ts
if (key === 'rawData') return '系统原始记录（高级信息）';
```

- [ ] **Step 2: 调整详情弹窗中的高级信息显示**

```tsx
<Collapse
  size="small"
  items={[
    {
      key: 'raw',
      label: formatDetailLabel('rawData'),
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={simpleListStyle}>
            {human.fieldsCn.map((item, index) => (
              <div
                key={`${item.label}-${index}`}
                style={{ padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
              >
                <Space size={6} style={{ width: '100%', justifyContent: 'space-between' }}>
                  <span style={{ opacity: 0.75 }}>{item.label}</span>
                  <span style={{ fontSize: 12, textAlign: 'right', maxWidth: 360 }}>{item.value}</span>
                </Space>
              </div>
            ))}
          </div>
          <Space wrap>
            <Button size="small" onClick={() => copy(humanText)} disabled={!log}>
              复制通俗说明
            </Button>
          </Space>
        </div>
      ),
    },
  ]}
/>
```

- [ ] **Step 3: 去掉面向普通用户的原始 JSON 直出**

```tsx
const rawText = useMemo(() => (log ? JSON.stringify(log, null, 2) : ''), [log]);
```

改成仅用于内部复制，不再直接 `<pre>` 展示在弹窗主体中。

- [ ] **Step 4: 运行页面测试，确认转绿**

Run: `cd /workspace/frontend && npm test -- src/pages/LogsPage.test.tsx`

Expected: PASS

- [ ] **Step 5: 提交**

```bash
cd /workspace
git add frontend/src/pages/LogsPage.tsx frontend/src/pages/LogsPage.test.tsx frontend/src/utils/beginnerCopy.ts
git commit -m "feat: localize visible log details into chinese"
```

---

### Task 5: 回归、构建和残词检查

**Files:**
- Test: `frontend/src/utils/logHumanizer.test.ts`
- Test: `frontend/src/utils/i18nErrors.test.ts`
- Test: `frontend/src/pages/LogsPage.test.tsx`
- Check: `frontend/src/utils/logHumanizer.ts`
- Check: `frontend/src/utils/i18nErrors.ts`
- Check: `frontend/src/pages/LogsPage.tsx`
- Check: `frontend/src/utils/beginnerCopy.ts`

- [ ] **Step 1: 跑目标测试**

Run: `cd /workspace/frontend && npm test -- src/utils/logHumanizer.test.ts src/utils/i18nErrors.test.ts src/pages/LogsPage.test.tsx`

Expected: PASS

- [ ] **Step 2: 跑前端构建**

Run: `cd /workspace/frontend && npm run build`

Expected: PASS

- [ ] **Step 3: 搜索日志页面残留英文和术语**

Run: `rg -n "analysis timeout after 45.00s|single_ai|rule_fallback|fallback|LOG-MDL-003|单AI|规则兜底" /workspace/frontend/src/pages/LogsPage.tsx /workspace/frontend/src/utils/logHumanizer.ts /workspace/frontend/src/utils/i18nErrors.ts /workspace/frontend/src/utils/beginnerCopy.ts`

Expected: 只允许保留在测试样例、转写匹配分支或注释里；不允许出现在用户最终展示文案里。

- [ ] **Step 4: 检查诊断**

Check diagnostics for:
- `frontend/src/utils/logHumanizer.ts`
- `frontend/src/utils/i18nErrors.ts`
- `frontend/src/pages/LogsPage.tsx`
- `frontend/src/utils/beginnerCopy.ts`

Expected: 无新增明显错误

- [ ] **Step 5: 提交最终实现**

```bash
cd /workspace
git add \
  frontend/src/utils/logHumanizer.ts \
  frontend/src/utils/logHumanizer.test.ts \
  frontend/src/utils/i18nErrors.ts \
  frontend/src/utils/i18nErrors.test.ts \
  frontend/src/utils/beginnerCopy.ts \
  frontend/src/pages/LogsPage.tsx \
  frontend/src/pages/LogsPage.test.tsx \
  docs/superpowers/specs/2026-05-10-log-display-full-chinese-design.md \
  docs/superpowers/plans/2026-05-10-log-display-full-chinese-implementation-plan.md
git commit -m "feat: localize visible log content into chinese"
```
