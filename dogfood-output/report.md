# Dogfood 报告：百家乐分析预测系统（从 0 到 100 全量深挖）

目标：以“真实用户/产品体验官”视角，覆盖主流程与边界场景，找出功能缺陷、体验问题、逻辑不通、旧逻辑残留与潜在回归风险，并给出可落地的修复建议与回归策略。

## 测试环境

- 访问地址：`http://localhost:8011`
- 浏览器：Chromium（自动化浏览器）
- 账号：管理员（密码 `8888`）
- 时间：2026-05-04

## 覆盖范围

- 首次进入/引导与默认模式
- 上传数据（键盘录入、珠盘录入、确认弹窗、模式差异、异常提示）
- 预测/下注/开奖/结算主流程（规则模式优先）
- 实盘日志（刷新、筛选、导出、空状态、权限）
- 模式选择与门禁（rule / 单AI / 3AI）
- 后台维护与任务（统计、清理、告警、任务列表/日志）
- 认证与权限（未登录、token 失效、越权）
- 稳定性（网络异常、接口失败、重复点击幂等）

## 摘要

- P0：0（已修复 2）
- P1：0（已修复 3）
- P2：0（已修复 2）
- P3：0（已修复 1）

---

## 发现的问题

（探索过程中逐条补充，包含复现步骤、截图/视频证据、影响与建议修复点）

### ISSUE-001（P0）：开奖接口 `/api/games/reveal` 在特定余额类型下触发 500（Decimal/float 混算）

**现象**
- 在“待开奖”状态点击“确认开奖”后，接口返回 500，导致整条链路中断（无法结算、无法推进局号）。

**根因**
- `decimal.Decimal` 与 `float` 混算触发 `TypeError`。
- 代码定位：[betting_service.py](file:///workspace/backend/app/services/betting_service.py) 的余额计算路径。

**状态**
- 已修复：统一 `BettingService.balance` 为 `float` 并补回归单测：[test_betting_service_decimal_balance.py](file:///workspace/backend/tests/test_betting_service_decimal_balance.py)。

---

### ISSUE-002（P2）：未登录时首页/列表页仍请求需要管理员权限的接口，产生 401 噪声与体验不一致

**现象**
- 未登录进入首页时，页面会自动请求：
  - `GET /api/logs?page=1...` → 401
  - `GET /api/bets?page=1...` → 401
- UI 表现为“暂无日志/暂无下注”，但并未提示需要管理员权限；同时后台产生无意义 401 噪声

**复现步骤**
1. 清空管理员登录状态（首次打开即可），访问：`http://localhost:8011/dashboard`
2. 打开网络请求列表，观察上述 401
3. UI 同时展示“暂无下注记录/暂无日志记录”  
   截图：`dogfood-output/screenshots/initial-dashboard.png`

**建议修复**
- 前端：未登录（无 token）时不请求管理员接口；对应模块显示“管理员登录后可查看”或直接隐藏模块入口
- 后端（可选）：对未携带 token 的请求返回更结构化错误码便于前端判断与埋点

**状态**
- 已修复：未登录时不再触发 `/api/logs` 与 `/api/bets` 请求（通过对 Query 增加 token 门禁）

---

### ISSUE-003（P1）：服务重启后“DB 有待开奖注单”但内存态丢失，导致前端页面缺少“开奖入口/提示”或状态错乱

**现象**
- 重启服务后，数据库里仍存在 `BetRecord.status=待开奖` 的注单，但内存 session 的 `pending_*` 被清空（或不存在）。
- 结果是：页面提示/按钮依赖内存态时可能缺失“开奖入口”，同时系统状态可能被 watchdog 回落到“等待开奖/空闲”但无法正确引导用户完成结算。

**状态**
- 已修复：启动恢复逻辑在 `recover_on_startup` 中额外扫描最近一条“待开奖注单”，并同步回内存 session + DB 状态；新增回归单测：[test_startup_recovery_pending_bet.py](file:///workspace/backend/tests/test_startup_recovery_pending_bet.py)。

---

### ISSUE-004（P2）：系统诊断接口同一 provider 的默认 model 口径不一致（影响运维判断与 UI 展示）

**现象**
- `/api/system/diagnostics` 同时返回 `models[]` 与 `models_status` 两套结构，但 Anthropic/Gemini 的默认 model fallback 不一致，导致“同一个 provider 输出两个不同的默认 model”。

**状态**
- 已修复：统一 `models_status` fallback 与 `models[]` 一致：[system.py](file:///workspace/backend/app/api/routes/system.py)。

---

### ISSUE-005（P0）：E2E “全表清空/造数”路由具备强破坏性，需防止生产环境误开启

**现象**
- E2E 路由具备 `delete(GameRecord/BetRecord/SystemLog/BackgroundTask)` 级别能力；若生产误配 `E2E_TESTING=true`，破坏面极大。

**状态**
- 已修复：E2E 路由仅在 `E2E_TESTING=true` 且 `ENVIRONMENT != "production"` 时挂载；并在路由层二次兜底返回 404：[main.py](file:///workspace/backend/app/api/main.py) / [e2e_testing.py](file:///workspace/backend/app/api/routes/e2e_testing.py)。

---

### ISSUE-006（P3）：资金相关日志/页面展示存在“整数化”输出，可能误导用户对盈亏与余额的理解

**现象**
- 后端资金日志使用 `:.0f` 输出，前端列表多处使用 `toFixed(0)`；在出现 `0.5` 这类金额时，UI 会显示与真实数值不一致（例如 `598.5` 被显示为 `+599`）。

**状态**
- 已修复：
  - 后端结算日志改为保留两位小数：[reveal.py](file:///workspace/backend/app/services/game/reveal.py)。
  - 前端统一引入金额格式化工具并用于关键表格与余额展示：[money.ts](file:///workspace/frontend/src/utils/money.ts)。

---

### ISSUE-007（P1）：开启新靴/结束本靴会清空 MistakeBook/AIMemory（历史资产误删风险）

**现象**
- `mode="new_boot"` 时对 `MistakeBook` 与 `AIMemory` 直接全表删除（非按 boot 删除），属于不可逆清理。

**影响评估**
- 如果产品期望“错题本/学习记忆跨靴累积”，这会导致资产被抹除。
- 如果产品期望“每靴独立”，则该行为合理，但需要在 UI 上更强提示（“将清空历史错题/记忆”）。

**状态**
- 已修复（采用跨靴保留）：
  - new_boot 不再全表删除 MistakeBook/AIMemory：[upload.py](file:///workspace/backend/app/services/game/upload.py#L155-L166)
  - end_boot 不再全表删除 MistakeBook/AIMemory：[boot.py](file:///workspace/backend/app/services/game/boot.py#L19-L70)
  - 新增/更新回归用例：[test_new_boot_preserves_cross_boot_assets.py](file:///workspace/backend/tests/test_new_boot_preserves_cross_boot_assets.py) / [test_boot_change_clears_micro_learning.py](file:///workspace/backend/tests/test_boot_change_clears_micro_learning.py)

---

### ISSUE-008（P1）：管理员调账接口 `/api/system/balance` 在余额为 Decimal 时触发 500

**现象**
- 在某些数据库字段类型/驱动返回为 `Decimal` 的情况下，`sess.balance` 可能被同步为 `Decimal`，导致调账时出现 `Decimal += float` 报错并返回 500。

**状态**
- 已修复：
  - 启动/同步路径强制把 `sess.balance` 转为 `float`：[state.py](file:///workspace/backend/app/services/game/state.py)。
  - 调账路径在加减前强制 `float` 并统一 `round(,2)`：[system.py](file:///workspace/backend/app/api/routes/system.py)。

## 代码审计观察（非阻塞，但建议纳入优化）

### NOTE-001：三模型服务对外宣称“无限重试/永不失败”，但实现是有限重试后返回降级 JSON

- 文件：`backend/app/services/three_model_service.py`
- 现状：文案多处描述“无限重试/永不失败”，但 `AIClient.max_retries = 5`，失败后返回 `_get_fallback_json()`
- 风险：产品承诺与实际行为不一致，用户可能以为系统一定会等到成功，但实际上会回退固定输出
- 建议：二选一
  - 方案A：修正文案（明确“最多重试 N 次，失败走安全降级”）
  - 方案B：实现真正的“无限重试 + 取消/超时兜底”机制，并把回退策略改为显式可配置

### NOTE-002：AI 配置中的 provider 字段更多用于展示/门禁，运行时主要由 base_url+model 决定

- 现状：管理后台保存 provider，但三模型/单模型客户端的“协议形态”基本固定（OpenAI/Anthropic/Gemini/OpenAI兼容）
- 风险：UI 上切换 provider 可能让用户误以为会改变协议/鉴权/路径，但实际影响有限
- 建议：明确 provider 的语义（仅展示 vs 影响调用），或在服务层按 provider 分支处理不同协议
