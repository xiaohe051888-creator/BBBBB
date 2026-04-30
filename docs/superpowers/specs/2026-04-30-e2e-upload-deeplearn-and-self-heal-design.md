# 稳 + 快（续）：上传/深度学习 E2E 回归 + 自愈检测与修复 设计稿

日期：2026-04-30

## 目标

1. 把剩余两条关键链路补成可重复的端到端回归测试：
   - 上传→（触发分析）→下注→开奖→（触发下一局分析）
   - 结束本靴→深度学习→状态回落到“等待新靴”
2. 增强系统“自愈能力”的可操作性：
   - 诊断能发现“卡住/积压”的信号
   - 提供一个可手工触发的修复入口（不依赖外部定时任务）
3. 不追求成本优化（省），但保证稳定性与响应速度（稳+快）。

## 约束与策略

- E2E 测试不调用真实大模型或真实学习流程：
  - 上传/分析链路：强制使用规则引擎（prediction_mode=rule）
  - 深度学习链路：对 `AILearningService.start_learning` 做 mock，快速返回成功结果
- 不新增第三方测试依赖，沿用现有 `unittest + asyncio.run`。
- 自愈不做“后台无限循环巡检”（避免引入新的长驻行为与误修复风险），只做：
  - 启动时恢复（已做）
  - 诊断 + 手工修复 endpoint

## 设计

### 1) E2E：上传→分析→下注→开奖→下一局分析

测试目标：
- 上传数据后，会触发后台分析任务（task_type=analysis）并能正常完成（规则模式）
- 分析结果会触发下注（产生 BetRecord，“待开奖”）
- 开奖后会结算注单（BetRecord 更新为“已结算/和局退回”）
- 开奖后会再次触发下一局后台分析任务（analysis）

实现策略：
- 直接调用 service 层函数（避免 HTTP 与 WS 依赖）：
  - `upload_games(...)`
  - `run_ai_analysis(...)`（规则模式）
  - `place_bet(...)`（由路由逻辑调用的部分在测试里显式调用）
  - `reveal_game(...)`
- 通过查询 `background_tasks` 表验证后台任务记录是否生成、状态是否更新。

### 2) E2E：结束本靴→深度学习→等待新靴

测试目标：
- end_boot 在满足条件（>=5局、无待开奖）时会：
  - 设置状态为“深度学习中”
  - 创建 deep_learning 后台任务记录
- run_deep_learning 完成后会：
  - 系统状态回落到“等待新靴”
  - 记录系统日志（LOG-BOOT-002）

实现策略：
- 准备足够 GameRecord（>=5）并设置 `prediction_mode="ai"`
- 调用 `end_boot` 后对 `AILearningService.start_learning` mock 返回 success/version
- 直接调用 `run_deep_learning(boot_number)` 以模拟后台任务执行并验证最终状态

### 3) 自愈：诊断增强 + 手工修复 endpoint

新增 `/api/system/repair`（需要鉴权）：
- 复用现有恢复逻辑：
  - `recover_on_startup` 的“取消 running 后台任务 + 状态回落”能力
- 额外修复项（仅当满足明显异常时）：
  - 若 SystemState.status 处于“分析中/深度学习中”且后台任务表不存在对应 running 任务，则回落到安全态并写 SystemLog

同时增强 `/api/system/diagnostics`：
- 输出：
  - running 的后台任务数量（按类型）
  - 是否检测到“状态卡住信号”（状态=分析中/深度学习中，但无对应 running 任务）

## 验收

1. 新增 2 个 E2E 测试文件，覆盖两条关键链路，单独运行与全量运行均通过。
2. `/api/system/repair` 能在模拟异常状态下完成修复并写入系统日志。
3. 后端全量 unittest 通过；不引入新的外部依赖。

