# 2026-05-09 Road Density Adjustment Design

## 背景

上一轮已经解决了五路图大部分右侧留白问题，但用户继续指出了三个具体问题：

1. `小路` 和 `螳螂路` 右边仍有明显空白。
2. `珠盘路` 的数据圆圈偏小，手机上不够醒目。
3. 其他路的数据区每一列中间间隔过大，画面显得松散。

这说明现有“统一按容器宽度拉大列间距”的策略过于粗糙，需要改成按不同路型分别处理。

## 目标

- 放大 `珠盘路` 的圆点与文字，提高手机端可读性。
- 收紧 `大路 / 大眼仔路 / 小路 / 螳螂路` 的横向列间距，让走势更紧凑。
- 继续收掉 `小路 / 螳螂路` 的右侧空白，让路图尽量贴边铺开。

## 非目标

- 不改五路图整体卡片布局。
- 不改后端路图数据结构。
- 不重写路图算法，只调整展示密度和宽度策略。

## 方案

### 1. 珠盘路单独放大

- 仅对 `珠盘路` 提高 `cellSize` 和 `fontSize`。
- 保留当前 6 行高度限制，不通过无限拉大列间距来撑满宽度。
- 让 `珠盘路` 主要依靠“更大圆点”提升观感，而不是靠“更宽空列”制造铺满感。

### 2. 派生路按真实列数收边

- `小路` 和 `螳螂路` 不再强制至少 8 列。
- 改成按真实数据列数决定内容宽度，并只保留一个较小的安全下限。
- 这样在局数较少时，右侧不会继续被保留大量空列。

### 3. 其他路统一收紧横向间距

- `大路 / 大眼仔路 / 小路 / 螳螂路` 的自适应横向间距上限下调。
- 目标是“有一点呼吸感，但不松散”，让每条路横向更紧密。
- 纵向间距保持不变，避免 6 行高度再次被破坏。

## 影响文件

- `frontend/src/components/roads/FiveRoadChart.tsx`
- `frontend/src/components/roads/BeadRoadCanvas.tsx`
- `frontend/src/components/roads/BigRoadCanvas.tsx`
- `frontend/src/components/roads/DerivedRoadCanvas.tsx`
- `frontend/src/types/road.ts`
- `frontend/src/pages/AdminMobileLayoutRegression.test.ts`

## 测试

- 扩展 `AdminMobileLayoutRegression.test.ts`
- 跑 `npm test -- src/pages/AdminMobileLayoutRegression.test.ts`
- 跑 `npm run build`
- 推送后用线上真实页面复测五路图
