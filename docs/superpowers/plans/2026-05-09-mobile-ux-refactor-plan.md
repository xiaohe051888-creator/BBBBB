# Mobile UX Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构移动端的盈亏分布、日志详情、下注详情和五路走势图，让默认体验更适合小白用户。

**Architecture:** 保持现有数据接口和查询逻辑不变，只调整前端展示层的 JSX 结构、视觉层级和珠盘路自适应尺寸策略。测试先锁定结构，再做最小实现，最后通过构建和本地预览确认没有移动端回归。

**Tech Stack:** React, TypeScript, Ant Design, Vitest, Vite, CSS, Canvas

---

## 文件映射

- Modify: `frontend/src/pages/BetRecordsPage.tsx`
  - 重构 `盈亏分布` 卡和 `下注详情` 弹窗结构。
- Modify: `frontend/src/pages/LogsPage.tsx`
  - 重构日志详情弹窗的层级和信息块。
- Modify: `frontend/src/components/roads/FiveRoadChart.tsx`
  - 去掉珠盘路固定像素宽度，改成容器驱动布局。
- Modify: `frontend/src/components/roads/BeadRoadCanvas.tsx`
  - 加入容器宽度监听和格子尺寸自适应。
- Modify: `frontend/src/styles/global.css`
  - 为上述 4 个区域补充新的移动端样式。
- Test: `frontend/src/pages/AdminMobileLayoutRegression.test.ts`
  - 锁定盈亏分布、下注详情、珠盘路自适应的新结构。
- Test: `frontend/src/pages/LogsPage.test.tsx`
  - 锁定日志详情的信息块层级和默认隐藏技术字段。

### Task 1: 锁定失败测试

**Files:**
- Modify: `frontend/src/pages/AdminMobileLayoutRegression.test.ts`
- Modify: `frontend/src/pages/LogsPage.test.tsx`

- [ ] **Step 1: 给 `BetRecordsPage` 新结构写失败测试**

```ts
it('uses a compact profit summary card and a simplified bet detail layout for mobile UX', () => {
  const betRecords = readFileSync(resolve(__dirname, './BetRecordsPage.tsx'), 'utf8');
  const css = readFileSync(resolve(__dirname, '../styles/global.css'), 'utf8');

  expect(betRecords).toContain('className="bet-summary-card"');
  expect(betRecords).toContain('className="bet-summary-pill-row"');
  expect(betRecords).toContain('className="bet-detail-sheet"');
  expect(betRecords).toContain('className="bet-detail-primary-grid"');
  expect(css).toContain('.bet-summary-card {');
  expect(css).toContain('.bet-detail-sheet {');
});
```

- [ ] **Step 2: 给 `FiveRoadChart` 和 `BeadRoadCanvas` 新自适应结构写失败测试**

```ts
it('uses responsive bead road sizing instead of a fixed pixel width shell', () => {
  const fiveRoadChart = readFileSync(resolve(__dirname, '../components/roads/FiveRoadChart.tsx'), 'utf8');
  const beadRoadCanvas = readFileSync(resolve(__dirname, '../components/roads/BeadRoadCanvas.tsx'), 'utf8');
  const css = readFileSync(resolve(__dirname, '../styles/global.css'), 'utf8');

  expect(fiveRoadChart).toContain('className="roadmap-board-card bead-road-responsive-card"');
  expect(beadRoadCanvas).toContain('const [containerWidth, setContainerWidth] = useState(0);');
  expect(beadRoadCanvas).toContain('ResizeObserver');
  expect(css).toContain('.bead-road-responsive-card {');
});
```

- [ ] **Step 3: 给 `LogsPage` 新详情层级写失败测试**

```ts
expect(modalText).toContain('log-detail-hero');
expect(modalText).toContain('log-detail-block');
expect(modalText).toContain('发生了什么');
expect(modalText).toContain('对当前使用有什么影响');
expect(modalText).toContain('建议你接下来怎么做');
expect(modalText).not.toContain('事件编码');
expect(modalText).not.toContain('处理编号');
```

- [ ] **Step 4: 运行测试确认失败**

Run:

```bash
npm test -- src/pages/AdminMobileLayoutRegression.test.ts src/pages/LogsPage.test.tsx
```

Expected: FAIL，缺少新的类名或结构断言。

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/AdminMobileLayoutRegression.test.ts frontend/src/pages/LogsPage.test.tsx
git commit -m "test: lock mobile ux refactor structure"
```

### Task 2: 重构下注记录统计与详情

**Files:**
- Modify: `frontend/src/pages/BetRecordsPage.tsx`
- Modify: `frontend/src/styles/global.css`
- Test: `frontend/src/pages/AdminMobileLayoutRegression.test.ts`

- [ ] **Step 1: 实现紧凑的 `盈亏分布` 卡结构**

```tsx
<Card size="small" className="mobile-status-card bet-summary-card" style={{ marginBottom: 16 }}>
  <div className="bet-summary-card-head">
    <span className="bet-summary-title">盈亏分布</span>
    <span className="bet-summary-meta">{summary.winRate.toFixed(1)}% 胜率</span>
  </div>
  <div className="bet-summary-pill-row">
    <span className="bet-summary-pill is-win">胜 {summary.winCount}</span>
    <span className="bet-summary-pill is-loss">负 {summary.lossCount}</span>
    <span className="bet-summary-pill is-pending">待 {summary.pendingCount}</span>
  </div>
  <Progress ... />
  <div className="bet-summary-stat-row">
    <div className="bet-summary-stat">
      <span>总盈亏</span>
      <strong>{formatSignedMoney(summary.totalPnL)}</strong>
    </div>
    <div className="bet-summary-stat">
      <span>连胜连败</span>
      <strong>{Math.abs(summary.currentStreak)}{summary.currentStreak > 0 ? '胜' : summary.currentStreak < 0 ? '败' : '-'}</strong>
    </div>
  </div>
</Card>
```

- [ ] **Step 2: 把详情弹窗从 `Descriptions` 改成摘要卡**

```tsx
<div className="bet-detail-sheet">
  <div className="bet-detail-primary-grid">
    <div className="bet-detail-kpi">
      <span>局号</span>
      <strong>{selectedBet.game_number}</strong>
    </div>
    <div className="bet-detail-kpi">
      <span>方向</span>
      <Tag ...>{selectedBet.bet_direction}</Tag>
    </div>
    <div className="bet-detail-kpi">
      <span>状态</span>
      <Tag ...>{selectedBet.status}</Tag>
    </div>
    <div className="bet-detail-kpi">
      <span>盈亏</span>
      <strong>{selectedBet.profit_loss !== null ? formatSignedMoney(selectedBet.profit_loss) : '-'}</strong>
    </div>
  </div>
</div>
```

- [ ] **Step 3: 为下注详情补充紧凑列表**

```tsx
<div className="bet-detail-list">
  <div className="bet-detail-row"><span>下注时间</span><strong>{...}</strong></div>
  <div className="bet-detail-row"><span>下注金额</span><strong>¥{formatMoney(selectedBet.bet_amount)}</strong></div>
  <div className="bet-detail-row"><span>下注档位</span><strong>{selectedBet.bet_tier}</strong></div>
  <div className="bet-detail-row"><span>开奖结果</span><strong>{selectedBet.game_result || '-'}</strong></div>
  <div className="bet-detail-row is-block"><span>余额变化</span><strong>¥{formatMoney(selectedBet.balance_before)} → ¥{formatMoney(selectedBet.balance_after)}</strong></div>
  <div className="bet-detail-row is-block"><span>自适应说明</span><strong>{selectedBet.adapt_summary || '-'}</strong></div>
</div>
```

- [ ] **Step 4: 在 `global.css` 中新增下注统计和详情样式**

```css
.bet-summary-card { ... }
.bet-summary-pill-row { ... }
.bet-summary-pill.is-win { ... }
.bet-summary-stat-row { ... }
.bet-detail-sheet { ... }
.bet-detail-primary-grid { ... }
.bet-detail-kpi { ... }
.bet-detail-list { ... }
.bet-detail-row.is-block { ... }
```

- [ ] **Step 5: 运行测试确认通过**

Run:

```bash
npm test -- src/pages/AdminMobileLayoutRegression.test.ts
```

Expected: PASS，新的结构类名已被源码包含。

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/BetRecordsPage.tsx frontend/src/styles/global.css frontend/src/pages/AdminMobileLayoutRegression.test.ts
git commit -m "feat: redesign mobile bet summary and detail sheet"
```

### Task 3: 重构日志详情弹窗

**Files:**
- Modify: `frontend/src/pages/LogsPage.tsx`
- Modify: `frontend/src/styles/global.css`
- Test: `frontend/src/pages/LogsPage.test.tsx`

- [ ] **Step 1: 为日志详情加摘要头区和三段信息块**

```tsx
<div className="log-detail-sheet">
  <div className="log-detail-hero">
    <Tag color={PRIORITY_COLORS[log.priority]}>{priorityLabel(log.priority)}</Tag>
    <Typography.Title level={5} style={{ margin: 0 }}>{human.title}</Typography.Title>
  </div>
  <div className="log-detail-block is-neutral">
    <Typography.Text className="log-detail-label">发生了什么</Typography.Text>
    <Typography.Paragraph>{human.whatHappened || '-'}</Typography.Paragraph>
  </div>
  <div className="log-detail-block is-warning">
    <Typography.Text className="log-detail-label">对当前使用有什么影响</Typography.Text>
    <Typography.Paragraph>{human.impact || '-'}</Typography.Paragraph>
  </div>
  <div className="log-detail-block is-action">
    <Typography.Text className="log-detail-label">建议你接下来怎么做</Typography.Text>
    <Typography.Paragraph>{human.suggestion || '-'}</Typography.Paragraph>
  </div>
</div>
```

- [ ] **Step 2: 保持高级信息折叠区只承载原始字段**

```tsx
<Collapse
  size="small"
  items={[{
    key: 'raw',
    label: formatDetailLabel('rawData'),
    children: (...)
  }]}
/>
```

- [ ] **Step 3: 在 `global.css` 中新增日志详情视觉层级样式**

```css
.log-detail-sheet { ... }
.log-detail-hero { ... }
.log-detail-block { ... }
.log-detail-block.is-neutral { ... }
.log-detail-block.is-warning { ... }
.log-detail-block.is-action { ... }
.log-detail-label { ... }
```

- [ ] **Step 4: 运行日志页测试**

Run:

```bash
npm test -- src/pages/LogsPage.test.tsx
```

Expected: PASS，详情弹窗显示新的三段信息块结构。

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/LogsPage.tsx frontend/src/styles/global.css frontend/src/pages/LogsPage.test.tsx
git commit -m "feat: redesign log detail modal for beginners"
```

### Task 4: 重构珠盘路自适应布局

**Files:**
- Modify: `frontend/src/components/roads/FiveRoadChart.tsx`
- Modify: `frontend/src/components/roads/BeadRoadCanvas.tsx`
- Modify: `frontend/src/styles/global.css`
- Test: `frontend/src/pages/AdminMobileLayoutRegression.test.ts`

- [ ] **Step 1: 去掉 `FiveRoadChart` 里的珠盘路固定宽度**

```tsx
<div className="roadmap-board-card bead-road-responsive-card">
  <div className="bead-road-responsive-shell">
    {hasData.bead ? (
      <BeadRoadCanvas data={roads.bead} config={baseConfig} className="bead-road-responsive-canvas" />
    ) : (
      <EmptyState height={roadHeight} />
    )}
  </div>
</div>
```

- [ ] **Step 2: 在 `BeadRoadCanvas` 中加入容器宽度监听和动态格子尺寸**

```tsx
const [containerWidth, setContainerWidth] = useState(0);

const responsiveConfig = useMemo(() => {
  const width = containerWidth || fixedSize.width;
  const availableWidth = Math.max(width - mergedConfig.padding * 2, 120);
  const nextCellSize = Math.max(14, Math.min(22, Math.floor((availableWidth - 11 * mergedConfig.cellGap) / 12)));
  return { ...mergedConfig, cellSize: nextCellSize };
}, [containerWidth, mergedConfig, fixedSize.width]);
```

- [ ] **Step 3: 用新的配置替换固定尺寸计算**

```tsx
const fixedSize = useMemo(() => calculateBeadRoadSize(responsiveConfig), [responsiveConfig]);
const cellSize = responsiveConfig.cellSize;
const cellGap = responsiveConfig.cellGap;
const padding = responsiveConfig.padding;
```

- [ ] **Step 4: 在 `global.css` 中补珠盘路自适应样式**

```css
.bead-road-responsive-card { width: 100%; min-width: 0; }
.bead-road-responsive-shell { width: 100%; overflow: hidden; }
.bead-road-responsive-canvas { width: 100% !important; max-width: 100%; }
```

- [ ] **Step 5: 运行回归测试**

Run:

```bash
npm test -- src/pages/AdminMobileLayoutRegression.test.ts
```

Expected: PASS，珠盘路结构和自适应逻辑通过。

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/roads/FiveRoadChart.tsx frontend/src/components/roads/BeadRoadCanvas.tsx frontend/src/styles/global.css frontend/src/pages/AdminMobileLayoutRegression.test.ts
git commit -m "feat: make bead road responsive on mobile"
```

### Task 5: 总体验证

**Files:**
- Modify: `frontend/src/pages/BetRecordsPage.tsx`
- Modify: `frontend/src/pages/LogsPage.tsx`
- Modify: `frontend/src/components/roads/FiveRoadChart.tsx`
- Modify: `frontend/src/components/roads/BeadRoadCanvas.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: 跑目标测试集**

Run:

```bash
npm test -- src/pages/AdminMobileLayoutRegression.test.ts src/pages/LogsPage.test.tsx
```

Expected: PASS

- [ ] **Step 2: 运行完整前端构建**

Run:

```bash
npm run build
```

Expected: build 成功，无 TypeScript / Vite 编译错误。

- [ ] **Step 3: 检查诊断**

Run diagnostics for:

```text
frontend/src/pages/BetRecordsPage.tsx
frontend/src/pages/LogsPage.tsx
frontend/src/components/roads/FiveRoadChart.tsx
frontend/src/components/roads/BeadRoadCanvas.tsx
frontend/src/styles/global.css
```

Expected: 没有新引入的明显 lint / type 问题。

- [ ] **Step 4: 启动前端并手动验证**

Run:

```bash
npm run dev -- --host 0.0.0.0
```

Expected:

- `下注记录` 页的 `盈亏分布` 更紧凑，卡片边界明确
- `记录详情` 弹窗有清晰颜色层级
- `下注详情` 不再是重表格样式
- `五路走势图` 的 `珠盘路` 明显减少右侧空白

- [ ] **Step 5: 最终提交**

```bash
git add frontend/src/pages/BetRecordsPage.tsx frontend/src/pages/LogsPage.tsx frontend/src/components/roads/FiveRoadChart.tsx frontend/src/components/roads/BeadRoadCanvas.tsx frontend/src/styles/global.css frontend/src/pages/AdminMobileLayoutRegression.test.ts frontend/src/pages/LogsPage.test.tsx docs/superpowers/specs/2026-05-09-mobile-ux-refactor-design.md docs/superpowers/plans/2026-05-09-mobile-ux-refactor-plan.md
git commit -m "feat: improve mobile ux across stats details and roads"
```
