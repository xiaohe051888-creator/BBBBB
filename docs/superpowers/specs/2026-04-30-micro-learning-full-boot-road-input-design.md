# 微学习：基于当前靴全量五路（输入全量、留档摘要）设计稿

日期：2026-04-30

## 目标

1. 实时微学习（等待开奖期间）必须基于**当前靴全量历史局**与**全量五路走势**进行策略调整，用于提升后续分析预测准确率与胜率。
2. AIMemory 的 `road_snapshot` 留档不存“部分局/截断数据”，但为了避免数据库膨胀，采用“全量统计摘要”而非全量快照。

## 现状问题

- `micro_learning_current_trend` 虽然会读取当前靴全部已开奖记录并计算全量五路，但在写入 AIMemory 时对 road_snapshot 做了不安全的截断表达式，导致：
  - 有概率写入不正确/报错（从而微学习失败）
  - 即使成功，也会形成“只保存最近特征”的误导，与“基于全量五路”的产品口径不一致

## 设计

### A) 学习输入（必须全量）

- `game_history`：当前靴所有已开奖（result != None）的局
- `road_data`：调用 `UnifiedRoadEngine.get_all_roads(boot_number)` 的完整返回（五路全量 points）
- 将上述全量输入传给 `ThreeModelService.realtime_strategy_learning(...)` 生成实时策略文本

### B) 留档（摘要而非截断）

`AIMemory.road_snapshot` 存储 JSON 摘要，包含：

- `boot_number`
- `current_game_number`
- `roads`：big_road/bead_road/big_eye/small_road/cockroach_road
  - `point_count`：该路全量 points 数量
  - `last_points`：仅用于快速排查的尾部少量点（例如 10 个），不参与学习逻辑
  - `digest`：对全量 points 的稳定哈希（用于判断是否确实“基于全量”）

## 验收

1. 微学习不会因为 road_snapshot 截断逻辑而失败。
2. `realtime_strategy_learning` 的输入为全量五路数据（不是部分局）。
3. AIMemory 的 road_snapshot 为“全量摘要”而非“局部截断”。

