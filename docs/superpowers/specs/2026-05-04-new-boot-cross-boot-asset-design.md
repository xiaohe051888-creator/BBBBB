# 开启新靴（new_boot）跨靴资产保留设计

日期：2026-05-04

## 背景

当前系统支持上传数据时选择：
- 覆盖本靴（reset_current_boot）
- 开启新靴（new_boot）

在现有实现中，开启新靴会清理全表错题本与记忆，导致跨靴复盘与学习资产不可逆丢失，且容易被误操作触发。

相关代码：上传新靴路径会执行全表清理 [upload.py](file:///workspace/backend/app/services/game/upload.py#L155-L161)

## 决策结论

开启新靴采用「跨靴保留」策略：
- new_boot 只负责“靴切换 + 运行态重置 + 新靴数据写入起点”
- MistakeBook 与 AIMemory 作为“可复盘/可训练资产”按 boot_number 归档保留，不在 new_boot 中全表清空

## 目标

- 避免 new_boot 误操作造成历史错题/记忆资产丢失
- 保证新靴从干净的运行态开始（不会带入上一靴的 pending/预测/任务等工作流状态）
- 明确推理边界：实时推理只使用当前靴数据；历史资产用于统计/训练/复盘

## 非目标

- 不在本次变更中引入“跨靴实时推理”（即不把历史 AIMemory/MistakeBook 直接混入当前靴推理输入）
- 不在本次变更中重构错题本/记忆表结构（仅调整清理策略与使用边界）

## 现状问题

- new_boot 会执行：
  - `delete(MistakeBook)` 全表删除
  - `delete(AIMemory)` 全表删除
- 这与“错题本/记忆是资产”的产品目标冲突：
  - 无法做跨靴统计（错误类型、版本稳定性、回撤/风控参数校准等）
  - 无法对学习效果做跨靴评估
  - 误触发不可逆，且 UI 当前提示更聚焦“清空本靴数据”，对“清空历史资产”不够显式

## 新行为定义（推荐实现）

### 1）new_boot（开启新靴）

应执行：
- 生成新 boot_number（现有逻辑：取最大 boot_number + 1）
- 重置内存会话状态（现有 `_reset_session_state` 可继续沿用）
- 写入新靴的 GameRecord（从第 1 局开始）
- 设置系统状态进入分析流程（现有逻辑：分析中 → 下注/开奖链路）

不得执行：
- 不得全表删除 MistakeBook
- 不得全表删除 AIMemory

### 2）reset_current_boot（覆盖本靴）

保持现状：
- 删除“当前 boot”的 GameRecord / BetRecord / MistakeBook / RoadMap / AIMemory（按 boot_number 过滤）
- 内存会话强力清场

### 3）推理与学习边界

实时推理（analysis / micro_learning）：
- 只读取当前 boot_number 的 AIMemory/MistakeBook（如已有逻辑按 boot_number 过滤，则维持）
- 不引入跨靴历史作为实时推理输入，避免噪声污染当前靴节奏

统计/训练（深度学习、版本评估、运营统计）：
- 允许跨靴聚合查询 MistakeBook/AIMemory，用于统计与训练数据集构建

## 运维与安全阀（后续迭代）

新增一个独立的“历史资产清空”能力（不与 new_boot 绑定）：
- 管理后台按钮：清空历史错题本 / 清空历史记忆（可拆分）
- 强二次确认（例如：必须输入“清空历史资产”或勾选不可恢复）
- 展示将删除的数量与范围（按 boot 或按时间范围）
- 可接入 retention 机制：保留最近 N 天或最近 N 靴（避免数据长期膨胀）

说明：此能力可作为第二阶段实现，不阻塞本次 new_boot 语义修正。

## 验收标准（Acceptance Criteria）

- 开启新靴后：
  - 新靴正常开始，运行态不残留 pending/预测等工作流状态
  - 历史 boot 的 MistakeBook/AIMemory 记录仍存在（未被删除）
- 覆盖本靴后：
  - 仅清理当前 boot 的相关记录（包含 MistakeBook/AIMemory）
  - 其他 boot 的历史记录不受影响
- 实时推理不使用跨靴数据（仍按当前 boot_number 过滤）

## 回归测试建议

- 新增后端单测：
  - new_boot 不删除 MistakeBook/AIMemory（准备 2 个 boot 的数据，执行 new_boot 后断言两者仍在）
  - reset_current_boot 仅删除指定 boot_number 的 MistakeBook/AIMemory
- E2E（Playwright）：
  - 造数→new_boot→再造数，确认旧靴的错题/记忆统计仍可在后台统计中查询到（若前端未展示统计，可用 API 校验）

