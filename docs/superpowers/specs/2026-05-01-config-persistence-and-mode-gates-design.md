# 配置持久化一致性 + 模式门禁统一设计

日期：2026-05-01  
范围：修复“后台配置保存/服务启动读取/前端门禁判断”三者不一致导致的错判与体验问题。

## 背景与问题

当前系统存在多处“配置来源不一致”的风险：

1. **API Key 持久化路径不一致**
   - 服务启动从 `backend/.env` 加载环境变量
   - 但后台“保存配置”曾写入错误位置（例如 `backend/app/.env`），导致重启后显示“未配置”

2. **模式门禁口径不一致**
   - 管理员页切换到 3AI 模式的拦截规则偏宽松（曾允许只配置任意一个模型）
   - 但实时系统状态/诊断按严格口径（3AI 三项齐全才就绪）
   - 造成“能切换但仍显示未就绪/甚至运行降级”的割裂体验

## 目标

1. **配置持久化统一到同一位置**：后台保存与启动读取必须指向同一个 `.env`
2. **兼容迁移历史错误写入**：若发现旧的错误位置 `.env`，自动合并到正确位置，避免用户丢配置
3. **模式门禁统一口径**：
   - 3AI：必须 OpenAI+Anthropic+Gemini 三项均配置
   - 单AI：必须 SINGLE_AI_API_KEY 配置
   - 规则：无需 Key

## 设计方案

### 1）统一 `.env` 路径

- 规范：**项目级 `.env` 位于 `backend/.env`**
- 后台保存配置：写入 `backend/.env`
- 服务启动加载：读取 `backend/.env`

### 2）启动时自动迁移（兼容历史）

启动时执行：

- 若 `backend/app/.env` 存在且 `backend/.env` 不存在或缺少关键键：
  - 将 `backend/app/.env` 中的已配置项合并到 `backend/.env`
  - 合并策略：`backend/.env` 已有值优先，不覆盖已有值；仅补齐缺失键
  - 合并完成后：不输出任何密钥内容到日志，仅输出“已迁移/已合并”提示

关键键集合（只合并这些，避免引入无关项）：

- OPENAI_API_KEY / OPENAI_MODEL / OPENAI_API_BASE
- ANTHROPIC_API_KEY / ANTHROPIC_MODEL / ANTHROPIC_API_BASE
- GEMINI_API_KEY / GEMINI_MODEL / GEMINI_API_BASE
- SINGLE_AI_API_KEY / SINGLE_AI_MODEL / SINGLE_AI_API_BASE

### 3）管理员页模式切换门禁统一

管理员页切换模式时：

- 切到 3AI：必须 banker/player/combined 的 `api_key_set` 全为 true
- 切到 单AI：必须 single 的 `api_key_set` 为 true
- 切到 规则：不限制

并同步调整提示文案为严格口径，避免“能切换但未就绪”的矛盾。

## 验收标准

1. 在后台配置单AI Key 后，即使服务重启，单AI仍显示“已配置”
2. 若历史错误写入到 `backend/app/.env`，重启后系统会自动迁移，配置不丢失
3. 管理员页切到 3AI 时，如果三项不齐，会被明确拦截并提示需三项齐全
4. 实时系统状态与管理员门禁口径一致，不再出现“切得过去但状态仍未就绪”

