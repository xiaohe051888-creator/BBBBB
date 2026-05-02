# 实盘日志“小白解读 + 性能优化”Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让“实盘日志”默认展示可读的中文小白解读，并显著降低实时推送导致的页面卡顿；“复制”默认复制小白解读。

**Architecture:** 前端新增日志解读器（event_code 字典 + 全量兜底），并在 LogsPage 将展示分为“小白解读（默认）/技术原始数据（折叠）”。实时日志推送做批量缓冲（节流刷新 + 可暂停实时刷新），避免每条日志触发一次表格重渲染。

**Tech Stack:** React 18 + TypeScript + Ant Design + TanStack React Query + WebSocket；前端测试使用 Vitest（已在本仓库引入）。

---

## Files map

**Create**
- `frontend/src/utils/logHumanizer.ts`：把 LogEntry 转成“小白解读”结构 + 生成可复制文本
- `frontend/src/utils/logHumanizer.test.ts`：单测（常见事件 + 未知兜底）

**Modify**
- `frontend/src/pages/LogsPage.tsx`：列表/详情展示小白解读 + 复制默认复制小白解读 + 实时推送缓冲/暂停
- `frontend/src/hooks/useQueries.ts`：新增批量乐观插入日志工具（一次 flush 批量更新缓存）
- `frontend/src/types/models.ts`：如需，为 UI 侧补充类型（不改后端返回结构）

**Run**
- `cd frontend && npm test && npm run lint && npm run build`

---

### Task 1: 新增日志小白解读器（全量覆盖）

**Files:**
- Create: `frontend/src/utils/logHumanizer.ts`
- Test: `frontend/src/utils/logHumanizer.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import type { LogEntry } from '../types/models';
import { humanizeLog, toHumanCopyText } from './logHumanizer';

describe('logHumanizer', () => {
  it('humanizes known event_code', () => {
    const log: LogEntry = {
      id: 1,
      log_time: '2026-05-02T00:00:00',
      game_number: 2,
      event_code: 'LOG-STL-001',
      event_type: '结算',
      event_result: '成功',
      description: '第2局开庄，注单结算：未命中（开庄），盈亏-10，余额990',
      category: '资金事件',
      priority: 'P2',
      is_pinned: false,
    };
    const h = humanizeLog(log);
    expect(h.title).toContain('结算');
    expect(h.whatHappened).toContain('第2局');
    expect(toHumanCopyText(log)).toContain('发生了什么');
  });

  it('falls back to generic for unknown event_code', () => {
    const log: LogEntry = {
      id: 2,
      log_time: '2026-05-02T00:00:00',
      game_number: null,
      event_code: 'SOME-UNKNOWN',
      event_type: '未知事件',
      event_result: '成功',
      description: 'something happened',
      category: '系统事件',
      priority: 'P3',
      is_pinned: false,
    };
    const h = humanizeLog(log);
    expect(h.title).toContain('未知事件');
    expect(h.suggestion).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `cd frontend && npm test`
Expected: FAIL（`logHumanizer.ts` 不存在）

- [ ] **Step 3: Implement minimal humanizer**

```ts
import type { LogEntry } from '../types/models';

export type HumanLog = {
  title: string;
  whatHappened: string;
  impact: string;
  suggestion: string;
  fieldsCn: Array<{ label: string; value: string }>;
};

const _safe = (v: unknown) => (v === null || v === undefined ? '' : String(v));

const _priorityCn = (p: string) =>
  p === 'P0' ? '致命' : p === 'P1' ? '严重' : p === 'P2' ? '警告' : p === 'P3' ? '信息' : '未知';

type Rule = (log: LogEntry) => HumanLog;

const rules: Record<string, Rule> = {
  'LOG-STL-001': (log) => ({
    title: `结算结果：第${_safe(log.game_number)}局已完成结算`,
    whatHappened: _safe(log.description) || '本局已结算。',
    impact: '会影响余额与命中统计；属于正常业务流程。',
    suggestion: '无需操作，可继续下一局。',
    fieldsCn: [],
  }),
};

export const humanizeLog = (log: LogEntry): HumanLog => {
  const baseFields: Array<{ label: string; value: string }> = [
    { label: '时间', value: _safe(log.log_time) },
    { label: '靴内局号', value: log.game_number === null ? '-' : String(log.game_number) },
    { label: '严重程度', value: _priorityCn(_safe(log.priority)) },
    { label: '类别', value: _safe(log.category) || '-' },
    { label: '事件', value: _safe(log.event_type) || '-' },
    { label: '结果', value: _safe(log.event_result) || '-' },
    { label: '任务编号', value: _safe(log.task_id) || '-' },
  ];

  const r = rules[_safe(log.event_code)];
  const human = r
    ? r(log)
    : {
        title: `${_safe(log.event_type) || '系统事件'}：${_safe(log.event_result) || '已记录'}`,
        whatHappened: _safe(log.description) || '系统产生了一条日志记录。',
        impact: '一般不会影响使用；如页面出现异常可刷新重试。',
        suggestion: '无需处理；若持续出现且影响使用，请截图反馈。',
        fieldsCn: [],
      };

  return { ...human, fieldsCn: [...human.fieldsCn, ...baseFields] };
};

export const toHumanCopyText = (log: LogEntry): string => {
  const h = humanizeLog(log);
  const lines = [
    `【${h.title}】`,
    '',
    `发生了什么：${h.whatHappened}`,
    `有什么影响：${h.impact}`,
    `建议怎么做：${h.suggestion}`,
    '',
    '关键信息：',
    ...h.fieldsCn.map((f) => `- ${f.label}：${f.value}`),
  ];
  return lines.join('\n');
};
```

- [ ] **Step 4: Run tests and verify GREEN**

Run: `cd frontend && npm test`
Expected: PASS（logHumanizer 相关用例通过）

---

### Task 2: LogsPage 改造（小白解读默认 + 原始数据折叠 + 复制默认小白解读）

**Files:**
- Modify: `frontend/src/pages/LogsPage.tsx`

- [ ] **Step 1: Update “说明”列展示 human.title**
  - 在 columns 的 “说明” render 中调用 `humanizeLog(record).title`

- [ ] **Step 2: 详情弹窗分层**
  - Modal 中新增三段中文：发生了什么 / 有什么影响 / 建议怎么做
  - 展示“关键信息”表（fieldsCn）
  - 原始 JSON 放到折叠区（AntD Collapse 或 Typography/Divider + 展开按钮）
  - “复制”按钮默认复制 `toHumanCopyText(log)`；在折叠区内提供“复制原始数据”

- [ ] **Step 3: Manual sanity**
  - 打开 `http://localhost:8011/dashboard/logs` → 点“详情”：
    - 默认看到中文解读
    - 复制成功（复制到剪贴板为中文解读）

---

### Task 3: 性能优化（WS 批量缓冲 + 可暂停实时刷新 + 新日志计数）

**Files:**
- Modify: `frontend/src/hooks/useQueries.ts`
- Modify: `frontend/src/pages/LogsPage.tsx`

- [ ] **Step 1: 批量乐观更新 helper**
  - 在 `useQueries.ts` 新增 `useAddLogsOptimistically()`，签名 `(logs: LogEntry[]) => void`
  - 行为：同一 queryKey 只 `setQueryData` 一次，把多条新 log 合并去重后 slice

- [ ] **Step 2: LogsPage 做缓冲 flush**
  - 新增 `realtime` 开关（Switch：实时/暂停）
  - `useWebSocket({ onLog })` 回调里：
    - realtime=true：push 到 pending queue（useRef），每 300-500ms flush 一次调用 `addLogsOptimistically`
    - realtime=false：只累计 `pendingCount`，不刷新表格；显示“新日志 X 条”按钮，点一次才 flush

- [ ] **Step 3: Verify**
  - 连续产生大量日志时（上传/开奖/刷新），页面滚动与输入框不再明显卡顿

---

### Task 4: 回归

- [ ] **Step 1: Unit tests**
  - Run: `cd frontend && npm test`
  - Expected: PASS

- [ ] **Step 2: Lint/build**
  - Run: `cd frontend && npm run lint && npm run build`
  - Expected: PASS

- [ ] **Step 3: Update backend static + preview**
  - Run: `cp -r frontend/dist/* backend/static/`
  - 打开预览 `http://localhost:8011/dashboard/logs` 冒烟：小白解读展示、复制成功、不卡顿

