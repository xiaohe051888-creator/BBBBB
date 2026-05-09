# Road Density Adjustment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 调整五路图的点大小与横向密度，让珠盘路更醒目，并收掉小路和螳螂路的右侧空白。

**Architecture:** 保持现有五路图组件结构不变，只调整前端展示层的路图配置和自适应列间距策略。珠盘路单独放大点和文字，派生路改成按真实列数与更小间距铺排，最后通过测试、构建和线上复测确认效果。

**Tech Stack:** React, TypeScript, Canvas, Vitest, Vite

---

## 文件映射

- Modify: `frontend/src/types/road.ts`
- Modify: `frontend/src/components/roads/FiveRoadChart.tsx`
- Modify: `frontend/src/components/roads/BeadRoadCanvas.tsx`
- Modify: `frontend/src/components/roads/BigRoadCanvas.tsx`
- Modify: `frontend/src/components/roads/DerivedRoadCanvas.tsx`
- Test: `frontend/src/pages/AdminMobileLayoutRegression.test.ts`

### Task 1: 锁定失败测试

**Files:**
- Modify: `frontend/src/pages/AdminMobileLayoutRegression.test.ts`

- [ ] **Step 1: 写失败测试，锁定珠盘路放大和派生路收边**

```ts
it('uses larger bead road circles and tighter derived road spacing on mobile', () => {
  const fiveRoadChart = readFileSync(resolve(__dirname, '../components/roads/FiveRoadChart.tsx'), 'utf8');
  const beadRoadCanvas = readFileSync(resolve(__dirname, '../components/roads/BeadRoadCanvas.tsx'), 'utf8');
  const bigRoadCanvas = readFileSync(resolve(__dirname, '../components/roads/BigRoadCanvas.tsx'), 'utf8');
  const derivedRoadCanvas = readFileSync(resolve(__dirname, '../components/roads/DerivedRoadCanvas.tsx'), 'utf8');
  const roadTypes = readFileSync(resolve(__dirname, '../types/road.ts'), 'utf8');

  expect(fiveRoadChart).toContain('cellSize: 26');
  expect(fiveRoadChart).toContain('fontSize: 11');
  expect(beadRoadCanvas).toContain('maxGap: Math.max(mergedConfig.cellGap, 24)');
  expect(bigRoadCanvas).toContain('return Math.max(data?.max_columns || 0, 6);');
  expect(derivedRoadCanvas).toContain('return Math.max(data?.max_columns || 0, 4);');
  expect(roadTypes).toContain('DERIVED_ROAD_CONFIG');
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
npm test -- src/pages/AdminMobileLayoutRegression.test.ts
```

Expected: FAIL，说明源码里还没有新的路图密度配置。

### Task 2: 实现珠盘路放大与派生路收边

**Files:**
- Modify: `frontend/src/types/road.ts`
- Modify: `frontend/src/components/roads/FiveRoadChart.tsx`
- Modify: `frontend/src/components/roads/BeadRoadCanvas.tsx`
- Modify: `frontend/src/components/roads/BigRoadCanvas.tsx`
- Modify: `frontend/src/components/roads/DerivedRoadCanvas.tsx`

- [ ] **Step 1: 放大珠盘路基础配置**

```tsx
const beadConfig: RoadCanvasConfig = useMemo(() => ({
  ...baseConfig,
  cellSize: 26,
  fontSize: 11,
}), [baseConfig]);
```

- [ ] **Step 2: 珠盘路使用单独配置**

```tsx
<BeadRoadCanvas data={roads.bead} config={beadConfig} className="bead-road-responsive-canvas" />
```

- [ ] **Step 3: 降低珠盘路横向间距上限**

```ts
maxGap: Math.max(mergedConfig.cellGap, 24),
```

- [ ] **Step 4: 大路和大眼仔路收紧横向间距并降低空列下限**

```ts
const totalCols = useMemo(() => {
  return Math.max(data?.max_columns || 0, 6);
}, [data]);
```

- [ ] **Step 5: 小路和螳螂路进一步降低空列下限**

```ts
const totalCols = useMemo(() => {
  return Math.max(data?.max_columns || 0, 4);
}, [data]);
```

- [ ] **Step 6: 运行测试确认通过**

Run:

```bash
npm test -- src/pages/AdminMobileLayoutRegression.test.ts
```

Expected: PASS

### Task 3: 构建与上线验证

**Files:**
- Modify: `frontend/src/components/roads/FiveRoadChart.tsx`
- Modify: `frontend/src/components/roads/BeadRoadCanvas.tsx`
- Modify: `frontend/src/components/roads/BigRoadCanvas.tsx`
- Modify: `frontend/src/components/roads/DerivedRoadCanvas.tsx`
- Modify: `frontend/src/pages/AdminMobileLayoutRegression.test.ts`

- [ ] **Step 1: 跑构建**

Run:

```bash
npm run build
```

Expected: build 成功。

- [ ] **Step 2: 提交**

```bash
git add frontend/src/types/road.ts frontend/src/components/roads/FiveRoadChart.tsx frontend/src/components/roads/BeadRoadCanvas.tsx frontend/src/components/roads/BigRoadCanvas.tsx frontend/src/components/roads/DerivedRoadCanvas.tsx frontend/src/pages/AdminMobileLayoutRegression.test.ts docs/superpowers/specs/2026-05-09-road-density-adjustment-design.md docs/superpowers/plans/2026-05-09-road-density-adjustment-plan.md
git commit -m "fix(frontend): tune road chart density on mobile"
```

- [ ] **Step 3: 推送**

```bash
git push origin main
```

- [ ] **Step 4: 线上复测**

Expected:

- 珠盘路圆点更大
- 小路右侧空白明显变少
- 螳螂路右侧空白明显变少
- 其他路横向列间距不再明显过大
