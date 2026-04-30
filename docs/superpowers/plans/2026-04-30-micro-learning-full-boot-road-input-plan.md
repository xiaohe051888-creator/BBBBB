# 微学习：基于当前靴全量五路（输入全量、留档摘要）Implementation Plan

## Task 1：先写回归测试（RED）

- [ ] 新增 `backend/tests/test_micro_learning_uses_full_roads.py`
  - 构造 boot 的多局 GameRecord
  - mock `UnifiedRoadEngine.get_all_roads` 返回含较多 points 的 road_data
  - mock `ThreeModelService.realtime_strategy_learning` 返回固定策略文本
  - 运行 `micro_learning_current_trend` 后断言：
    - 生成了一条 AIMemory（error_type=实时推演策略）
    - road_snapshot JSON 内每条路的 `point_count` 等于 mock 的全量 points 数（不是 5 或其它截断值）

## Task 2：实现（GREEN）

- [ ] 修改 `backend/app/services/game/learning.py`
  - 新增“road_snapshot 摘要构造”函数
  - 移除不安全的 `[-5:]` 截断表达式
  - `road_snapshot` 写入摘要 JSON

## Task 3：验证

- [ ] 运行新增测试
- [ ] 后端全量 unittest

