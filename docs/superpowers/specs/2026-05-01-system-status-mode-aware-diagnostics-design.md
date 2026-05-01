# 实时系统状态按模式适配设计（3AI / 单AI / 规则）

日期：2026-05-01  
范围：后端 `/api/system/diagnostics` + `/api/system/health` 与前端“实时系统状态”面板全链路按模式适配，避免 3AI 时代的固定假设导致误导与误报。

## 背景

系统现支持三种预测模式：

- `ai`：3AI（三模型）
- `single_ai`：单AI（DeepSeek）
- `rule`：规则引擎

历史的“实时系统状态/诊断”模块是在只有 3AI 的阶段建设的，默认只检查 OpenAI/Anthropic/Gemini 三个 Key，并将“缺 Key”直接上升为系统告警/健康降级。  
现状下会出现：

- 用户选择单AI/规则模式，但面板仍强调“三模型未配置”的告警，造成误解。
- `overallHealth` 与健康分对 AI 的判定不随模式变化，导致“当前模式明明可用但灯是黄/红”。

目标是做到：**整个系统的“就绪/告警/健康”以“当前选择的模式”为准**，同时**分层展示其他模式就绪度**作为信息提示，不影响当前模式的健康灯。

## 目标与非目标

### 目标

1. 后端 diagnostics/health 按 `prediction_mode`（当前模式）计算“必需项是否就绪”。
2. 前端实时系统状态面板按当前模式展示必需项，并可折叠查看“其它模式就绪度”。
3. 保持向后兼容：旧字段继续存在，避免其他页面/旧逻辑直接崩溃。

### 非目标

- 不改变下注/开奖/深度学习等核心业务状态机。
- 不引入新依赖。

## 关键定义（决策）

### 模式必需项（Required）

- `ai`（3AI）：**必须同时配置 OpenAI + Anthropic + Gemini** 才认为 3AI 就绪  
  原因：系统设计与服务实现（ThreeModelService）强调“三模型专业分工、满血运行”，缺任一模型都不符合 3AI 定义。
- `single_ai`：必须配置 `SINGLE_AI_API_KEY`（并满足长度阈值）才认为单AI就绪。
- `rule`：无需任何 Key，默认就绪；不因缺 Key 降级健康灯。

### 分层展示（Layered Readiness）

- `current_mode_readiness`：仅评估当前模式必需项（影响 `overall_status_current_mode` 与 health 分数）。
- `other_modes_readiness`：对非当前模式进行就绪度计算，仅做信息提示（不影响当前模式健康灯）。

## 后端改造设计

### 1）`GET /api/system/diagnostics`

保留现有字段以兼容前端：

- `openai_enabled` / `anthropic_enabled` / `gemini_enabled`
- `models_detail`
- `issues` / `overall_status`

新增字段（供新前端使用）：

- `current_mode`: `"ai" | "single_ai" | "rule"`
- `models`: 统一模型列表（包含 3AI+单AI）
  - 字段建议：
    - `key`: `"openai" | "anthropic" | "gemini" | "single_ai"`
    - `label`: `"庄模型" | "闲模型" | "综合模型" | "单AI"`
    - `provider`: `"openai" | "anthropic" | "gemini" | "deepseek" | "rule"`
    - `model`: 具体模型名（例如 `gpt-4o-mini` / `claude-...` / `gemini-...` / `deepseek-v4-pro`）
    - `enabled`: boolean
    - `required_in_current_mode`: boolean
    - `required_in_modes`: string[]（例如 `["ai"]` / `["single_ai"]`）
    - `issue`: string | null
- `mode_readiness`：
  - `ai`: `{ required: ["openai","anthropic","gemini"], configured_count, missing, status }`
  - `single_ai`: `{ required: ["single_ai"], configured_count, missing, status }`
  - `rule`: `{ required: [], configured_count: 0, missing: [], status: "ok" }`
- `issues_current_mode`: 仅当前模式导致不可用/降级的告警
- `issues_other_modes`: 仅信息提示（例如“单AI未配置，不影响当前3AI模式”）
- `overall_status_current_mode`: `"ok" | "warning" | "critical"`

判定规则：

- `ai`：
  - missing == 0 => ok
  - missing > 0 => critical（因为 3AI 必须三项齐全）
- `single_ai`：
  - missing == 0 => ok
  - missing > 0 => critical
- `rule`：
  - 永远 ok

同时保留原 `issues/overall_status`，但建议：

- `issues` = `issues_current_mode + issues_other_modes`（带 level=info 的其他模式提示）
- `overall_status` 兼容旧字段时，可保持旧逻辑或映射为 `overall_status_current_mode`（推荐映射，减少旧前端误报）

### 2）`GET /api/system/health`

现状 `ai_models` 评分固定基于 3AI。需要改造为“按当前模式计分 + 其它模式仅提示”。

新增或调整输出结构（兼容旧字段）：

- 旧字段：`details.ai_models` 保留，但改为“当前模式 AI”视角
- 新字段（推荐新增）：`details.ai_by_mode`
  - `current_mode`: string
  - `current_mode_ai`: `{ score, max, issues }`
  - `other_modes_ai`: `{ issues_by_mode }`

计分建议：

- `ai` 模式：
  - max=40，三项各占一部分；缺任一项扣分并写入 issues
- `single_ai` 模式：
  - max=40，单AI占满；缺 key 则扣满并写入 issues
- `rule` 模式：
  - max=40，直接给满分（不因 key 缺失扣分），但把“其它模式未配置”写入 `other_modes_ai.issues_by_mode`

## 前端改造设计

### 1）`useSystemDiagnostics`

现状将 `aiModels` 写死为三项，并将缺配置直接作为告警来源。改造为：

- 从 `/api/system/state` 读取 `prediction_mode`（已存在）作为 UI 的“当前模式”
- 从 `/api/system/diagnostics` 读取新字段：
  - `current_mode`
  - `models` / `mode_readiness`
  - `issues_current_mode` / `issues_other_modes`
- 生成派生字段：
  - `aiCurrentOk`: 当前模式就绪 boolean
  - `aiOtherReadiness`: 其它模式就绪摘要（用于信息提示）
  - `activeIssues`：
    - current_mode issues -> warning/critical
    - other_modes issues -> info（不影响 overallHealth）
- `overallHealth`：
  - 仍优先后端/WS/DB critical
  - AI 只以 `issues_current_mode` 影响 overallHealth

### 2）`SystemStatusPanel`

改造 UI 文案与结构：

- 标题从“AI三模型”改为“AI配置（当前模式）”
- Tag 列表：
  - 只强调 `required_in_current_mode=true` 的模型为“必需”
  - 其他模型为“其它模式”并折叠展示
- Tooltip/展开面板里新增：
  - 当前模式：3AI/单AI/规则
  - 当前模式就绪：ok/critical + missing 列表
  - 其它模式就绪度：提示性信息

## 测试策略

后端：

- `/api/system/diagnostics` 在三种模式下：
  - `current_mode` 正确
  - `mode_readiness[current]` 状态正确
  - `issues_current_mode` 与 `issues_other_modes` 正确分层

前端：

- 在三种模式下：
  - 面板不再出现“单AI模式下仍显示 AI三模型必需”的误导
  - overallHealth 不因非当前模式缺 key 变黄/红

## 验收标准

1. 切到 `single_ai`：实时系统状态只要求 single_ai key；3AI 缺 key 仅提示不告警。
2. 切到 `rule`：不因任何 key 缺失而告警；可提示其它模式未配置。
3. 切到 `ai`：必须三项齐全，否则明确 critical（与 3AI 定义一致）。
4. 全系统文案与状态不混用，不再“3AI 时代写死”。

