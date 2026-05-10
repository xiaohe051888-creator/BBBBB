# All Visible Content Chinese Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把日志 JSON 导出和管理页中剩余的用户可见英文、字母编码与技术化术语继续清理成自然中文。

**Architecture:** 保持后端接口、字段和值不变，只改前端展示与导出层。先用测试锁住 JSON 导出必须走中文人话结果，再补 `AdminPage` 与 `beginnerCopy` 的模式名称和说明文案中文化，最后跑日志页、工具函数、构建和残词检查，必要时推送部署。

**Tech Stack:** React, TypeScript, Ant Design, Vitest, Vite

---

## File Map

- Modify: `frontend/src/pages/LogsPage.tsx`
  - 把 `JSON` 导出改成用户可读中文导出
- Modify: `frontend/src/pages/LogsPage.test.tsx`
  - 锁住导出内容不再直出英文、事件码和原始技术说明
- Modify: `frontend/src/utils/logHumanizer.ts`
  - 提供页面与导出复用的中文结构
- Modify: `frontend/src/utils/logHumanizer.test.ts`
  - 锁住导出内容仍复用人话结果
- Modify: `frontend/src/utils/beginnerCopy.ts`
  - 收敛管理页与模式名称的用户可见中文话术
- Modify: `frontend/src/utils/beginnerCopy.test.ts`
  - 锁住管理页相关中文话术
- Modify: `frontend/src/pages/AdminPage.tsx`
  - 把用户可见技术文案切到中文产品语言

---

### Task 1: 锁住 JSON 导出必须走中文结构

**Files:**
- Modify: `frontend/src/pages/LogsPage.test.tsx`
- Modify: `frontend/src/utils/logHumanizer.test.ts`

- [ ] **Step 1: 在 `LogsPage.test.tsx` 增加导出 JSON 的失败测试**

```tsx
it('exports user-readable chinese json instead of raw technical log fields', async () => {
  const writeText = vi.fn();
  Object.assign(navigator, { clipboard: { writeText } });
  const anchorClicks: string[] = [];
  const originalCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
    const el = originalCreateElement(tagName);
    if (tagName === 'a') {
      Object.defineProperty(el, 'click', {
        value: () => {
          anchorClicks.push((el as HTMLAnchorElement).href);
        },
      });
    }
    return el;
  }) as typeof document.createElement);

  useLogsQueryMock.mockReturnValue({
    data: {
      logs: [
        {
          id: 1,
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
        },
      ],
      total: 1,
    },
    refetch: vi.fn(),
    isFetching: false,
    error: null,
  });

  // render LogsPage ... then click “导出数据”
  // after click:
  const href = anchorClicks[0];
  const encoded = href.split(',')[1];
  const text = decodeURIComponent(encoded);
  expect(text).toContain('智能分析：系统已自动改用备用判断');
  expect(text).toContain('这次发生了什么');
  expect(text).not.toContain('LOG-MDL-003');
  expect(text).not.toContain('analysis timeout after 45.00s');
  expect(text).not.toContain('rule_fallback');
});
```

- [ ] **Step 2: 在 `logHumanizer.test.ts` 增加导出结构辅助失败测试**

```tsx
it('builds export-friendly chinese log payloads', () => {
  const log: LogEntry = {
    id: 30,
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

  const payload = toHumanExportPayload(log);
  expect(payload['标题']).toBe('智能分析：系统已自动改用备用判断');
  expect(payload['这次发生了什么']).toBe('智能判断这次没有及时给出稳定结果，系统已经自动改用备用判断继续完成下注。');
  expect(JSON.stringify(payload)).not.toContain('LOG-MDL-003');
  expect(JSON.stringify(payload)).not.toContain('analysis timeout after 45.00s');
});
```

- [ ] **Step 3: 运行测试，确认先红**

Run: `cd /workspace/frontend && npm test -- src/pages/LogsPage.test.tsx src/utils/logHumanizer.test.ts`

Expected: FAIL，说明导出仍在走原始数据，`toHumanExportPayload()` 也尚未存在。

- [ ] **Step 4: 提交**

```bash
cd /workspace
git add frontend/src/pages/LogsPage.test.tsx frontend/src/utils/logHumanizer.test.ts
git commit -m "test: lock chinese json export for visible logs"
```

---

### Task 2: 实现用户可读 JSON 导出

**Files:**
- Modify: `frontend/src/utils/logHumanizer.ts`
- Modify: `frontend/src/pages/LogsPage.tsx`

- [ ] **Step 1: 在 `logHumanizer.ts` 增加导出专用结构函数**

```ts
export const toHumanExportPayload = (log: LogEntry) => {
  const h = humanizeLog(log);
  return {
    时间: formatBeijing(String(log.log_time), 'YYYY-MM-DD HH:mm:ss'),
    靴内局号: log.game_number === null ? '-' : String(log.game_number),
    标题: h.title,
    这次发生了什么: h.whatHappened,
    对当前使用有什么影响: h.impact,
    建议你接下来怎么做: h.suggestion,
    更多信息: h.fieldsCn.map((item) => ({
      名称: item.label,
      内容: item.value,
    })),
  };
};
```

- [ ] **Step 2: 在 `LogsPage.tsx` 改造 `exportToJSON()`**

```tsx
const exportToJSON = async () => {
  const exportLogs = logs.map((log) => toHumanExportPayload(log));
  const json = JSON.stringify(exportLogs, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `运行记录-${dayjs().format('YYYYMMDD-HHmmss')}.json`;
  a.click();
  URL.revokeObjectURL(url);
};
```

- [ ] **Step 3: 运行测试，确认转绿**

Run: `cd /workspace/frontend && npm test -- src/pages/LogsPage.test.tsx src/utils/logHumanizer.test.ts`

Expected: PASS

- [ ] **Step 4: 提交**

```bash
cd /workspace
git add frontend/src/utils/logHumanizer.ts frontend/src/pages/LogsPage.tsx
git commit -m "feat: export visible logs as chinese json"
```

---

### Task 3: 锁住管理页用户可见中文话术

**Files:**
- Modify: `frontend/src/utils/beginnerCopy.test.ts`

- [ ] **Step 1: 在 `beginnerCopy.test.ts` 增加管理页相关失败测试**

```tsx
it('uses chinese product-language labels for admin modes', () => {
  expect(formatAdminModeName('ai')).toBe('多路综合判断模式');
  expect(formatAdminModeName('single_ai')).toBe('智能判断模式');
  expect(formatAdminModeName('rule')).toBe('规则辅助模式');
});

it('uses chinese product-language labels for mode select cards', () => {
  expect(formatModeSelectLabel('aiCardTitle')).toBe('多路综合判断模式');
  expect(formatModeSelectLabel('singleCardTitle')).toBe('智能判断模式');
  expect(formatModeSelectLabel('ruleCardTitle')).toBe('规则辅助模式');
});

it('uses chinese product-language labels for detail summaries', () => {
  expect(formatDetailLabel('modelSummary')).toBe('智能分析摘要');
});
```

- [ ] **Step 2: 运行测试，确认先红**

Run: `cd /workspace/frontend && npm test -- src/utils/beginnerCopy.test.ts`

Expected: FAIL，因为当前仍是“单 AI 模式”“三模型协作模式”等旧叫法。

- [ ] **Step 3: 提交**

```bash
cd /workspace
git add frontend/src/utils/beginnerCopy.test.ts
git commit -m "test: lock chinese admin copy"
```

---

### Task 4: 实现管理页用户可见文案中文化

**Files:**
- Modify: `frontend/src/utils/beginnerCopy.ts`
- Modify: `frontend/src/pages/AdminPage.tsx`
- Modify: `frontend/src/utils/beginnerCopy.test.ts`

- [ ] **Step 1: 在 `beginnerCopy.ts` 收紧模式与页面文案**

```ts
export const formatAdminModeName = (mode: 'ai' | 'single_ai' | 'rule') => {
  if (mode === 'ai') return '多路综合判断模式';
  if (mode === 'single_ai') return '智能判断模式';
  return '规则辅助模式';
};
```

```ts
export const formatAiRoleLabel = (
  role: 'banker' | 'player' | 'combined' | 'single',
  variant: 'analysis' | 'config' = 'analysis',
) => {
  if (role === 'banker') return variant === 'config' ? '庄方向' : '庄方向判断';
  if (role === 'player') return variant === 'config' ? '闲方向' : '闲方向判断';
  if (role === 'combined') return '多路综合判断';
  return '智能判断';
};
```

```ts
if (key === 'aiCardTitle') return '多路综合判断模式';
if (key === 'singleCardTitle') return '智能判断模式';
if (key === 'ruleCardTitle') return '规则辅助模式';
```

```ts
if (key === 'modelSummary') return '智能分析摘要';
```

- [ ] **Step 2: 在 `AdminPage.tsx` 清理仍然硬编码的旧技术词**

```tsx
message.warning('规则辅助模式下无需系统学习优化');
message.success('系统学习优化已开始');
```

并检查所有可见标题、按钮、副文案是否还残留 `AI`、`单 AI`、`三模型协作` 这类旧文本。

- [ ] **Step 3: 运行测试，确认转绿**

Run: `cd /workspace/frontend && npm test -- src/utils/beginnerCopy.test.ts`

Expected: PASS

- [ ] **Step 4: 提交**

```bash
cd /workspace
git add frontend/src/utils/beginnerCopy.ts frontend/src/pages/AdminPage.tsx frontend/src/utils/beginnerCopy.test.ts
git commit -m "feat: localize visible admin copy into chinese"
```

---

### Task 5: 总回归、构建、残词检查与推送

**Files:**
- Check: `frontend/src/pages/LogsPage.tsx`
- Check: `frontend/src/utils/logHumanizer.ts`
- Check: `frontend/src/utils/beginnerCopy.ts`
- Check: `frontend/src/pages/AdminPage.tsx`
- Test: `frontend/src/pages/LogsPage.test.tsx`
- Test: `frontend/src/utils/logHumanizer.test.ts`
- Test: `frontend/src/utils/beginnerCopy.test.ts`

- [ ] **Step 1: 跑目标测试**

Run: `cd /workspace/frontend && npm test -- src/pages/LogsPage.test.tsx src/utils/logHumanizer.test.ts src/utils/beginnerCopy.test.ts src/utils/i18nErrors.test.ts`

Expected: PASS

- [ ] **Step 2: 跑前端构建**

Run: `cd /workspace/frontend && npm run build`

Expected: PASS

- [ ] **Step 3: 搜索残留用户可见技术词**

Run: `rg -n "AI|single_ai|rule_fallback|analysis timeout after 45.00s|LOG-MDL-003|单 AI|三模型协作模式|规则参考模式" /workspace/frontend/src/pages/AdminPage.tsx /workspace/frontend/src/pages/LogsPage.tsx /workspace/frontend/src/utils/beginnerCopy.ts /workspace/frontend/src/utils/logHumanizer.ts`

Expected: 只允许出现在内部枚举匹配、转写分支或注释中；不允许出现在最终用户展示文案和导出结构里。

- [ ] **Step 4: 检查诊断**

Check diagnostics for:
- `frontend/src/pages/LogsPage.tsx`
- `frontend/src/utils/logHumanizer.ts`
- `frontend/src/utils/beginnerCopy.ts`
- `frontend/src/pages/AdminPage.tsx`

Expected: 无新增明显错误

- [ ] **Step 5: 提交并推送**

```bash
cd /workspace
git add \
  frontend/src/pages/LogsPage.tsx \
  frontend/src/pages/LogsPage.test.tsx \
  frontend/src/utils/logHumanizer.ts \
  frontend/src/utils/logHumanizer.test.ts \
  frontend/src/utils/beginnerCopy.ts \
  frontend/src/utils/beginnerCopy.test.ts \
  frontend/src/pages/AdminPage.tsx \
  docs/superpowers/specs/2026-05-10-all-visible-content-chinese-cleanup-design.md \
  docs/superpowers/plans/2026-05-10-all-visible-content-chinese-cleanup-implementation-plan.md
git commit -m "feat: localize all visible admin and export content"
git push origin main
```
