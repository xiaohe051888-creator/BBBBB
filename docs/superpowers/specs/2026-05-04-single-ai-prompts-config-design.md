# 单AI模式提示词配置（预测 + 等待开奖策略）设计稿

## 背景

当前单AI模式存在两类提示词（prompt）：
- 下一局预测提示词：用于输出“庄/闲、置信度、建议档位、推理摘要/细节”
- 等待开奖策略提炼提示词：用于在下注后等待开奖期间输出 100-200 字策略总结

现状问题：
- 两段提示词主要是代码内写死，无法运营/调参
- 单AI模式在未配置密钥时只能模拟输出，且缺少“为什么要预测”的产品目标约束，导致提示词可能偏离业务目的

## 核心目标（要知道为了什么而预测）

系统做“分析预测”的目的不是为了“猜对”本身，而是为了在实盘下注场景中做到：
- **决策支持**：把复杂五路与历史的信号压缩成可执行的下注建议（庄/闲 + 档位 + 置信度 + 下注金额）
- **风险管理**：在“每局必须下注”的硬约束下，通过动态下注金额与档位控制回撤（低置信度/连错高→缩仓）
- **可解释与可复盘**：每次预测都要给出可解释的证据链（理由要点 + 详细推理），并在赛后可对照错题本快速迭代
- **一致性输出**：输出必须结构化（严格 JSON），便于系统自动下注、结算、统计、学习与回测

产品约束（写进提示词）：
- 每一局都必须给出明确的庄/闲预测，且每一局都必须自动下注
- 风险控制只允许通过“下注档位/下注金额”来体现（例如低置信度→保守档位），不允许不下注
- 不允许输出与系统执行不一致的信息（例如 JSON 外的文字、字段缺失、未知字段）

## 业务假设与提示词口径（随机性前提）

- 庄/闲每局结果在宏观上可视为随机，但在有限样本（五路走势）上会呈现短期结构/形态
- 任何形态都可能随时中断，因此提示词必须强调：
  - 用“概率 + 风险”语言表达，而不是“必然”
  - 通过档位控制把“必下每局”的硬约束转换为可控回撤

## 自动下注策略（金额控制）

目标：每局都下注，但下注强度随“置信度、余额、连续失准次数”动态调整。

推荐实现（可配置参数）：
- 先按置信度得到基础金额曲线（已有 `compute_bet_amount(confidence, balance)`）
- 再叠加连续失准衰减系数（错误越多越保守）：
  - `amount = base_amount * (error_decay ** consecutive_errors)`
  - 默认建议：`error_decay = 0.6`（更猛：连错 1 次变为 60%，连错 2 次 36%，连错 3 次 21.6%）
- 再叠加余额比例上限（避免在余额很大时一次押太重）：
  - `amount <= balance * max_balance_ratio`
- 最终仍遵守：
  - `MIN_BET / MAX_BET / BET_STEP`（系统已有）
  - 余额不足时无法下注，系统进入“余额不足”状态（物理约束）

## 配置范围

1) 单AI-下一局预测提示词模板（可配置）
- 作用路径：`run_ai_analysis(... prediction_mode="single_ai")` → `SingleModelService.analyze(...)`
- 输出要求：必须为严格 JSON，字段与现有解析逻辑兼容

2) 单AI-等待开奖策略提炼提示词模板（可配置）
- 作用路径：`SingleModelService.realtime_strategy_learning(...)`
- 输出要求：纯文本 100-200 字，不要分点编号，不要寒暄

## 方案总览（已确认）

- 预测提示词：存入数据库 `ModelVersion.prompt_template`，并限定 `prediction_mode="single_ai"`
  - 优先使用当前激活版本（`is_active=true`）的 `prompt_template`
  - 若不存在单AI版本或模板为空，回退到代码内默认提示词
- 等待开奖策略提示词：作为运行配置存入 `.env`（新增配置项），管理员可在线修改并即时生效

## 模板变量（占位符）

### 预测模板变量
与后端已有替换逻辑保持一致（字符串替换）：
- `{{BOOT_NUMBER}}`
- `{{GAME_NUMBER}}`
- `{{CONSECUTIVE_ERRORS}}`
- `{{GAME_HISTORY}}`（JSON）
- `{{ROAD_DATA}}`（JSON）
- `{{MISTAKE_CONTEXT}}`（JSON）

### 等待开奖策略模板变量
- `{{GAME_HISTORY}}`（JSON）
- `{{ROAD_DATA}}`（JSON）
- `{{CONSECUTIVE_ERRORS}}`

## 后端接口设计

新增（需管理员登录）：

1) `GET /api/admin/prompt-templates/single-ai`
- 返回：
  - `prediction_template`（string | null）
  - `realtime_strategy_template`（string | null）
  - `active_version`（string | null）
  - `prediction_mode` 固定为 `single_ai`

2) `POST /api/admin/prompt-templates/single-ai`
- 入参：
  - `prediction_template`（string，可为空，表示清空并回退默认）
  - `realtime_strategy_template`（string，可为空，表示清空并回退默认）
- 行为：
  - prediction_template：若不存在 `single_ai` 激活版本则创建并设为 active；否则更新当前激活版本的 `prompt_template`
  - realtime_strategy_template：写入 `.env` 并更新运行时 settings
- 安全：
  - 不回显密钥
  - 仅管理员可操作

## 前端交互设计

管理员 → “AI大模型与规则引擎” Tab 新增卡片：单AI提示词配置
- 文本域：
  - 单AI-下一局预测提示词模板（含占位符说明）
  - 单AI-等待开奖策略提示词模板（含占位符说明）
- 操作：
  - 保存
  - 恢复默认（清空模板）

## 兼容性与回退策略

- 未配置 API KEY：维持现有行为（返回模拟 JSON / 提示未配置）
- 已配置 API KEY 但模板为空：使用代码默认提示词（确保系统可用）
- 模板配置错误导致 JSON 解析失败：维持现有解析失败兜底输出（保守档位 + 给出庄/闲之一）

## 测试计划

- 后端：
  - 单测：GET/POST 模板接口
  - 单测：写入 prediction_template 后，`SmartModelSelector.get_current_version("single_ai")` 可读到并在分析中生效
  - 单测：写入 realtime_strategy_template 后，策略提炼调用使用新模板
- 前端：
  - 组件测试：保存成功/失败提示
  - E2E（可选）：管理员保存模板后触发单AI分析，页面能显示新摘要内容
