# 单AI模式“五路全靴特征预处理”增强设计稿

## 背景与问题

单AI模式当前会把以下信息传给模型：
- 全靴历史 `game_history`
- 全靴五路 `road_data`（大路/珠盘路/大眼仔/小路/螳螂）
- 错题上下文 `mistake_context`

虽然 `road_data` 已包含完整点位，但大模型对“路牌点位坐标序列”进行稳定解读的成本较高，容易出现：
- 同样数据不同轮次关注点漂移（不稳定）
- 只盯某一路（忽略其余路）
- 五路冲突时缺少统一的降级逻辑

## 目标（用户硬约束）

- 必须基于**当前靴完整五路**进行分析：五条路一条不能漏、全量点位不能截断。
- 每一局都必须预测并自动下注：只允许输出“庄/闲”，不允许观望。
- 在不改变“全量五路输入”的前提下，提高预测输出的一致性与可控性。

## 方案概述

在保持原始 `road_data` 全量输入不变的前提下，新增一个确定性的“特征预处理层”：

- `road_data`：仍然传入全量点位（原样）
- `road_features`：由后端从全量五路点位与历史记录中计算出的结构化特征摘要

单AI提示词模板增加占位符 `{{ROAD_FEATURES}}`，并要求模型：
- 必须逐路复核 5 路（不能漏）
- 先基于 `road_features` 做投票/冲突判断，再结合原始 `road_data` 做解释
- 输出严格 JSON，字段固定，且 `final_prediction` 只能是“庄/闲”

## 数据结构

### 输入（现有）
- `game_history`: `[{"game_number": int, "result": "庄/闲/和"}...]`
- `road_data`: `{"big_road": {...}, "bead_road": {...}, "big_eye": {...}, "small_road": {...}, "cockroach_road": {...}}`
  - 每条路包含 `display_name`, `points`（点位含 column/row/value 等）

### 新增输出：road_features（后端生成）

`road_features` 为 JSON，可直接序列化并注入提示词：

```json
{
  "boot_number": 1,
  "game_number": 23,
  "roads_present": ["big_road","bead_road","big_eye","small_road","cockroach_road"],
  "history_stats": {
    "total_non_tie": 22,
    "banker_count": 12,
    "player_count": 10,
    "banker_ratio": 0.545,
    "recent_non_tie_tail": ["庄","闲","庄","庄","闲","庄"]
  },
  "per_road": {
    "big_road": {
      "display_name": "大路",
      "last_value": "庄",
      "run_length": 3,
      "switches_last_12": 5,
      "vote": 1,
      "signal_strength": 0.62,
      "break_risk": "medium"
    },
    "bead_road": { "...": "..." },
    "big_eye": {
      "display_name": "大眼仔路",
      "last_value": "红",
      "run_length": 4,
      "red_ratio_last_24": 0.58,
      "vote": 1,
      "signal_strength": 0.60,
      "break_risk": "low"
    }
  },
  "ensemble": {
    "score": 3,
    "conflict_score": 0.2,
    "vote_detail": { "big_road": 1, "bead_road": 0, "big_eye": 1, "small_road": 1, "cockroach_road": 0 }
  }
}
```

说明：
- **全量原则**：所有统计都基于全靴完整点位；允许额外计算一些“近期敏感指标”，但不能只用近期窗口替代全量。
- `vote` 取值：偏庄=+1，偏闲=-1，中性=0（下三路红/蓝的投票映射由提示词解释，后端只提供统计与建议）
- `conflict_score` 用于量化五路分歧程度（0~1），用于提示词中强制降级
- `break_risk` 为低/中/高，表示形态中断风险提示（确定性规则产物）

## 后端实现设计

### 新增模块：road_features.py

职责：输入 `game_history` + `road_data`，输出 `road_features`（仅做纯计算，不读写 DB）。

关键计算（示例）：
- 历史统计：非和局总数、庄闲占比、最近 N 个非和局尾序列
- 每条路：
  - points 序列按“形成顺序”提取 value 列表（game_number 升序）
  - 末值、末段连续长度（run_length）
  - 近 12/24 的切换次数（switches）
  - 下三路红/蓝比例（red_ratio）
  - 中断风险（break_risk）：基于 run_length 突变、切换频率、短期反复等确定性规则
- 组合层：
  - `score`：5 路 vote 求和（后端可先给建议 vote；最终投票仍由提示词约束模型必须给出）
  - `conflict_score`：依据 vote 分裂程度与信号强度差计算

### 接入点：run_ai_analysis

在 `app/services/game/analysis.py` 调用 `SingleModelService.analyze(...)` 前：
- 生成 `road_features`
- 将其传入单AI prompt 渲染

### SingleModelService 改动

`_build_prompt` 与 `_build_prompt_with_template` 新增占位符渲染：
- `{{ROAD_FEATURES}}`：JSON 字符串（ensure_ascii=False）

并在默认 prompt 中加入“必须逐路核对 5 路 + 先看 ROAD_FEATURES 再解释 ROAD_DATA”的约束段落。

## 前端与配置

- 管理员页“单AI提示词配置”占位符说明新增：`{{ROAD_FEATURES}}`
- 默认提示词模板更新为“硬规则工作流版”（逐路提取→投票→冲突降级→严格 JSON）

## 兼容性与回退

- 若 `road_features` 生成异常：继续只传 `road_data`（不影响系统可用性）。
- 若模板未包含 `{{ROAD_FEATURES}}`：保持现状（仅原始五路输入）。
- 模型输出非严格 JSON：继续走既有解析/清洗与兜底（保证只出庄/闲）。

## 测试

- 单测：`road_features` 在给定固定输入时输出稳定（run_length/switches/conflict_score 等）。
- 单测：prompt 渲染结果包含 `ROAD_FEATURES` 的 JSON 片段。
- 回归：后端 pytest + 前端 lint/test/build 全通过。

