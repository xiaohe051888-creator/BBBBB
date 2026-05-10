# Analysis UI And Fallback Design

**Date:** 2026-05-10

**Goal:** 重构首页 `智能分析` 板块与 `推理详情` 页面，让移动端用户一眼看懂“这局押什么、为什么押、来源是单AI还是规则兜底”；同时保证 `每一局都必须下注`，单AI失败时自动切到规则兜底，不允许整局漏下注。

**Architecture:** 统一把“本局建议”抽象成一个稳定的 `analysis outcome`，不管它来自 `single_ai` 还是 `rule_fallback`，前端都走同一套极简结果卡 + 详情页结构。后端在单AI成功时输出五路逐条解释和最终综合解释；单AI失败时用规则引擎生成同样结构的人话解释，并自动完成下注。

**Tech Stack:** React, TypeScript, Ant Design, React Query, WebSocket optimistic updates, Python FastAPI, aiohttp

---

## 1. Product Rules

### 1.1 必须满足的业务规则

- 每一局都必须下注，不允许因为单AI失败而跳过本局。
- 单AI调用失败、超时、限流、解析失败时，系统必须自动切换到 `规则兜底`，继续生成本局方向并自动下注。
- 用户在首页必须始终看到一个明确的本局结论，而不是技术错误堆栈或接口报错。
- 详情页必须能用小白语言解释：
  - 每一条路当前怎么看
  - 每一条路更偏向庄还是闲
  - 最终为什么综合成庄或闲
  - 如果是规则兜底，为什么系统改走规则兜底

### 1.2 不允许再出现的体验

- 首页直接展示“上游接口调用失败”“安全降级输出”这类技术口径。
- 首页同时堆太多标签、模式、技术名词，导致用户看不出最终结论。
- 详情页整页长文本堆砌，没有分段和重点。
- 单AI失败后整局停在“分析中”或“不下注”。

---

## 2. UX Design

### 2.1 首页智能分析板块

采用 `方案 A：极简结果卡`。

首页卡片只保留以下信息：

- 标题：`智能分析`
- 主结果：`本局建议：庄 / 闲`
- 来源标签：
  - `单AI判断`
  - `规则兜底`
- 风险标签：
  - `把握度高`
  - `把握度中`
  - `把握度低`
- 一句白话结论：
  - 例如：`当前大路延续更明显，下三路没有出现反转信号，本局建议继续跟庄。`
- 一个动作按钮：`查看详细原因`

首页不再直接展示以下内容：

- 单AI技术型号长标签大面积占位
- 多层 AI 角色卡片
- 技术失败描述正文
- 生硬的“0% + 调用失败 + 上游错误”组合

### 2.2 首页失败态

当单AI失败但规则兜底成功时，首页仍显示完整下注建议，但要明确来源：

- 主结果仍显示：`本局建议：庄 / 闲`
- 来源显示：`规则兜底`
- 白话说明示例：
  - `本局AI没有及时给出稳定结果，系统已改用规则判断继续下注。`

当规则兜底也无法生成结果时，才允许显示异常态；但该设计不以“允许漏下注”为目标，本次实现优先保证规则兜底一定生成方向。

### 2.3 推理详情页

详情页改成分段式说明，不再使用长段纯文本堆叠。

结构如下：

1. `本局结论`
   - 本局建议方向：庄 / 闲
   - 结论来源：单AI判断 / 规则兜底
   - 把握度：高 / 中 / 低
   - 一句话结论

2. `五条路怎么看`
   - 大路
   - 珠盘路
   - 大眼仔路
   - 小路
   - 螳螂路

   每条路统一回答三件事：
   - 当前形态是什么
   - 这条路偏向庄还是偏向闲
   - 这条路对最终判断的支持强弱

   每条路都必须使用小白能懂的句子，避免“共振”“回摆确认”这类没有解释的术语直接出现。

3. `最终为什么押这个方向`
   - 汇总五条路后，哪几条在支持庄，哪几条偏中性，哪几条在提醒风险
   - 最终为什么落到庄或闲
   - 如果有风险，需要提醒“建议保守”还是“可以标准跟”

4. `来源说明`
   - 单AI成功时：
     - `本局由单AI直接完成判断，系统按单AI结果下注。`
   - 规则兜底时：
     - `本局单AI没有返回稳定结果，系统改用规则判断完成本局下注。`

5. `技术说明（折叠区，次级）`
   - 仅用于管理员或排障时查看
   - 放置具体失败原因：超时、429、5xx、解析失败、参数不兼容等
   - 默认折叠，不直接暴露给普通用户

---

## 3. Data Contract

### 3.1 统一前端消费结构

新增统一 `analysis outcome` 数据结构，前端不再直接把单AI原始文本硬塞进 UI。

建议结构：

```ts
interface AnalysisOutcome {
  direction: '庄' | '闲';
  confidence: number;
  confidence_label: '高' | '中' | '低';
  source: 'single_ai' | 'rule_fallback';
  short_reason: string;
  final_reason: string;
  fallback_reason?: string | null;
  road_explanations: {
    big_road: RoadExplanation;
    bead_road: RoadExplanation;
    big_eye_road: RoadExplanation;
    small_road: RoadExplanation;
    cockroach_road: RoadExplanation;
  };
  technical_diagnostic?: {
    code?: string | null;
    message?: string | null;
  } | null;
}

interface RoadExplanation {
  trend_label: string;
  tendency: '庄' | '闲' | '中性';
  support_level: '强' | '中' | '弱';
  plain_summary: string;
}
```

### 3.2 单AI成功时

- 后端优先解析单AI输出中的：
  - 五条路逐条解释
  - 最终综合解释
  - 最终方向
  - 风险与档位建议
- 如果现有 prompt 无法稳定产出五条路结构化字段，需要更新单AI prompt 和解析器，使其输出稳定 JSON。

### 3.3 单AI失败时

- 规则引擎必须直接产出同一份 `AnalysisOutcome` 结构。
- `source = rule_fallback`
- `fallback_reason` 写成白话说明
- `technical_diagnostic` 保留真实错误摘要
- 前端不需要知道是哪个底层函数生成，只看统一结构渲染

---

## 4. Backend Flow

### 4.1 目标流程

正常流程：

1. 开奖完成
2. 启动下一局单AI分析
3. 单AI成功返回结构化结果
4. 生成 `AnalysisOutcome`
5. 自动下注
6. 广播前端

兜底流程：

1. 开奖完成
2. 启动下一局单AI分析
3. 单AI失败 / 超时 / 解析失败
4. 触发规则兜底分析
5. 生成 `AnalysisOutcome`
6. 自动下注
7. 广播前端，并标记 `source = rule_fallback`

### 4.2 失败分类

后端要区分并记录至少这些原因：

- `timeout`
- `rate_limit`
- `upstream_5xx`
- `bad_response_format`
- `unsupported_parameter`
- `unknown_upstream_error`

### 4.3 关键行为

- 单AI失败不再等于“本局不下注”
- 单AI失败后必须继续调用规则兜底，而不是只把状态回退到空闲
- 只有规则兜底也失败时，才允许进入异常态；但本次实现目标是让规则兜底具备稳定产出能力，尽量避免该分支

---

## 5. Frontend Components

### 5.1 `AnalysisPanel`

职责调整：

- 只负责展示本局最终结果卡
- 不再直接拼装大量模式/来源/推理技术细节
- 只展示用户最需要的结论

显示层级：

- 结果
- 把握度
- 一句话原因
- 来源标签
- 查看详情按钮

### 5.2 详情组件

将现有 `Drawer` 内容改成结构化阅读卡片，而不是一段 `pre-wrap` 文本。

建议拆成独立组件：

- `AnalysisResultCard`
- `AnalysisRoadExplanationList`
- `AnalysisFinalReasonCard`
- `AnalysisSourceCard`
- `AnalysisDiagnosticCollapse`

这样后续单AI与规则兜底都复用同一套结构。

### 5.3 文案原则

- 所有用户主文案必须是小白能懂的话
- 技术名词只能放在折叠的技术诊断区
- 把“形态”“风险”“支持方向”翻译成自然中文，例如：
  - `大路连续走庄，说明主走势还没有明显转向`
  - `小路现在偏乱，说明这一局虽然还是偏庄，但不建议激进下注`

---

## 6. Testing

### 6.1 Backend

新增/更新测试覆盖：

- 单AI成功时，生成结构化 `AnalysisOutcome`
- 单AI超时时，自动切规则兜底并继续下注
- 单AI返回坏 JSON 时，自动切规则兜底
- 规则兜底结果包含五条路解释和最终解释
- 广播给前端的数据里带 `source = rule_fallback`

### 6.2 Frontend

新增/更新测试覆盖：

- 首页成功态渲染极简结果卡
- 首页规则兜底态渲染正确来源标签和人话文案
- 详情页展示五条路解释
- 详情页展示最终为什么押庄/押闲
- 技术说明默认折叠
- 不再直接显示“上游接口调用失败”作为首页主文案

### 6.3 Manual Verification

真实流程至少验证两轮：

1. 单AI正常成功 -> 自动下注 -> 开奖 -> 下一局
2. 人工制造单AI失败 -> 自动走规则兜底 -> 自动下注 -> 首页与详情正确展示来源和解释

---

## 7. Scope

### In Scope

- 智能分析板块移动端重构
- 推理详情页重构
- 单AI失败时规则兜底下注
- 五条路逐条解释的人话输出
- 技术失败原因的后台记录与前端次级展示

### Out Of Scope

- 重新设计整页 Dashboard 其他模块
- 修改五路图绘制逻辑
- 重做管理员配置页
- 更换单AI供应商

---

## 8. Risks And Guardrails

- 如果单AI prompt 结构化输出不稳定，解析层必须有容错，不得把垃圾原文直接暴露到首页。
- 如果规则兜底解释过于技术化，需要在文案层再做一次白话翻译。
- 如果首页卡片又塞回过多标签和二级信息，会重新回到当前“用户看不懂重点”的问题，因此首页必须保持极简。

---

## 9. Recommended Implementation Order

1. 先定义统一 `AnalysisOutcome` 数据结构
2. 改造单AI成功输出与失败兜底输出
3. 确保“失败也继续下注”的后台流程稳定
4. 重构 `AnalysisPanel`
5. 重构推理详情组件
6. 补测试与真实账号复测
