# 系统从 0 到 100 全面修复设计（单用户：一次登录 + 稳定性/可诊断性优先）

日期：2026-05-02  
目标：在“仅你自己使用、只需登录一次”的体验前提下，清理隐藏故障点，提升稳定性、可诊断性与一致性；并把关键“误用即出事”的点改成默认不踩坑（即使你不是公网部署）。

## 背景（本轮排查发现的问题类型）

1) **鉴权边界不清晰**：部分写操作与 WebSocket 允许匿名，若服务在局域网可达会产生误操作风险。  
2) **CORS 行为不一致**：错误处理器强制写入 `Access-Control-Allow-Origin: *`，可能绕过正常白名单策略。  
3) **吞错导致“表面正常、实际异常”**：多处 `except: pass` / 吞异常会把故障掩盖成“无任务/无提示”。  
4) **后台任务触发缺少去重/节流**：upload/reveal 高频调用时可能造成任务堆积。  
5) **UI/交互歧义**：模式选择弹窗多个按钮同名“启用”，容易误点。

## 设计原则

- 单用户体验：**只需登录一次**（前端持久化 token 并自动附带）。  
- 默认安全不打扰：不要求你配置复杂安全项，但避免“无意间暴露到局域网就被操作”的情况。  
- 可诊断：任何关键异常都应有可追踪痕迹（日志/返回码/系统日志），而不是静默吞掉。  
- 变更最小化：尽量复用现有认证逻辑与任务框架，不做大规模重构。

## 决策与方案

### A. 鉴权策略（一次登录）

**目标：核心写操作 + WebSocket 必须有 token；只读接口可保持公开以保证总览页无需先登录也能查看。**

强制鉴权：
- `POST /api/games/upload`
- `POST /api/games/reveal`
- `POST /api/system/prediction-mode`（切换模式）
- `GET /api/admin/database-records`（管理员库浏览）
- `WS /ws`（订阅广播）

保持公开（读操作）：
- `/api/system/health`
- `/api/system/state`
- `/api/system/diagnostics`（如你希望完全“登录一次”，也可以后续改为需要鉴权）
- `/api/games`、`/api/roads*`、`/api/stats`（仪表盘展示所需）

前端改动：
- 登录成功后把 token 持久化（现有做法如已存在则沿用）
- WebSocket 连接带上 token（query 参数或 header，优先 query：`/ws?token=...`）

### B. WebSocket 门禁

- 无 token：直接拒绝连接（返回关闭码 4401/1008 均可，前端提示“请先登录”）。
- 有 token：通过 `get_current_user` 校验后允许连接。

### C. CORS 一致性修正

- 移除全局异常处理器里强制写 `Access-Control-Allow-Origin: *` 的逻辑，让 CORS 完全由 CORSMiddleware 决定。
- `allow_credentials` 默认关闭（前端使用 Authorization header，不依赖 cookie）。
- `CORS_ORIGINS` 默认值保持开发友好（localhost:5173 等），你需要局域网访问时再扩展。

### D. 吞错改为可诊断（不泄露敏感信息）

针对“必须知道失败原因”的位置，把 `except: pass` 改为：
- `logger.exception(...)`（不打印密钥）
- 关键流程可写入 SystemLog（P1/P2）或返回明确错误，避免 UI 端“无响应”

### E. 后台任务去重/节流

目标：同一靴号/同一局的分析任务避免并发堆叠。

实现建议（最小侵入）：
- 在触发分析时使用任务注册器的 `dedupe_key`（例如 `analysis:{boot_number}` 或 `analysis:{boot_number}:{next_game_number}`）
- 若已存在 running 的同 key 任务：不再创建新任务，直接返回/记录一次 info 日志

### F. UI 交互歧义修正

- “选择模式”弹窗中多个“启用”按钮改成明确文本：
  - `启用 3AI 模式`
  - `启用 单AI 模式`
  - `启用 规则模式`
- 对不可用模式：按钮禁用 + 提示原因（缺 key）

## 验收标准

1. 登录一次后：上传/开奖/WebSocket 均正常；未登录时这些入口明确提示需要登录（不再静默失败）。  
2. CORS 行为一致：错误响应不再强行返回 `*`。  
3. 关键异常不再被吞：出现问题时能在日志/系统日志里看到可追踪记录。  
4. 高频触发 upload/reveal 不会造成 analysis 任务无限堆积。  
5. 模式选择 UI 不再出现多按钮同名导致误点。

