# 产品体验官 0→100 深度走查报告（第 7 轮）

目标：从真实用户视角（未登录→登录→选模式→上传→分析→下注→开奖→结算→记录/日志→错题本→维护）进行系统化 dogfood，找出功能/UX/一致性/旧逻辑影响新逻辑问题，并给出可复现证据（截图）与修复建议。

环境：
- 前端：`http://localhost:5173`
- 后端：`http://localhost:8001`
- 测试时间：2026-05-04

## 总览

- 发现问题：3
- P0：2
- P1：1
- P2：0

## 走查覆盖面

- 入口与未登录态（公共探活/脱敏系统态）
- 登录弹窗与 token 生命周期
- 模式选择页（3AI/单AI/规则）
- Dashboard（状态栏、AI分析、五路图、自动下注与开奖）
- 上传数据页（键盘录入、确认上传、模式参数）
- 日志页（实时/搜索/导出）
- 下注记录页、错题本页
- 管理员页（余额、模式切换、维护/清理、任务列表）

## 证据索引

- screenshots/initial.png

## 问题清单

### ISSUE-001（首次进入即出现“测试/历史脏数据”）

- 严重级别：P1
- 复现步骤：
  1. 本地启动前后端服务（默认使用 `backend/data/baccarat.db`）
  2. 打开 `http://localhost:5173/dashboard`
- 期望：首次启动/新用户应显示“空数据库”空态（无下注/无日志/无历史记录），或明确提示这是示例数据并提供一键清空
- 实际：页面展示大量历史下注/日志记录（含“测试高优先级错误”等测试痕迹），对真实用户造成误导
- 证据截图：`screenshots/issue-001-initial-data.png`
- 影响范围：新用户首屏体验、运维/排障（真实告警与测试日志混在一起）
- 修复建议：
  - 发布包/仓库不应携带带数据的 `baccarat.db`（改为 `.gitignore` 或仅提供空 schema）
  - 首次启动检测到“非空数据+处于 development”时提示并提供“清空数据/重置系统”入口

- 状态：已推进（提供一键清空能力 + 默认不提交 DB 文件）
  - 后端新增：`POST /api/admin/maintenance/reset-all`（仅开发环境可用，清空所有业务表并重置系统态）
  - 前端新增：管理员页 → 数据库存储 → “清空全部数据”

### ISSUE-002（退出登录后仍可看到上一次登录的敏感数据：前端缓存未清理）

- 严重级别：P0
- 复现步骤：
  1. 登录进入系统（任意模式均可）
  2. 打开 Dashboard/下注记录/日志等页面，让数据加载完成
  3. 进入管理员页点击“退出登录”
  4. 返回 Dashboard
- 期望：退出登录后，所有需要鉴权的数据（下注记录/日志/错题本/后台任务等）应立即清空或显示“请登录”空态
- 实际：退出登录后页面仍展示退出前缓存的下注记录与日志列表（即使后端接口已加鉴权，前端缓存仍泄露）
- 证据截图：`screenshots/issue-002-logout-cache.png`
- 影响范围：安全/权限边界（多人共用设备、演示环境、截屏分享）
- 修复建议：
  - 在 `clearToken()` 时同步清空 react-query 缓存（`queryClient.clear()` 或至少 `removeQueries`：bets/logs/mistakes/tasks 等）
  - 或者在各 Query 的 `enabled` 变为 false 时返回空 placeholder，并在 token 变化时 `setQueryData` 置空

- 状态：已修复
  - 修复点：监听 `auth_token_changed` 并执行 `queryClient.clear()`，确保登出/会话过期不会泄露私有缓存
  - 代码：[App.tsx](file:///workspace/frontend/src/App.tsx#L251-L258)
  - 修复后证据：`screenshots/issue-002-fixed.png`

### ISSUE-003（控制台持续刷“Maximum update depth exceeded”，导致页面性能抖动甚至崩溃）

- 严重级别：P0
- 复现步骤：
  1. 打开 `http://localhost:5173/dashboard`
  2. 观察浏览器控制台
- 期望：控制台无 React “Maximum update depth exceeded” 错误
- 实际：控制台持续输出 “Maximum update depth exceeded” 并伴随页面频繁重渲染（根因包括：WebSocket hook 重复订阅 + 多处 Table/Modal props 每次 render 生成新对象触发内部 setState）
- 影响范围：性能、稳定性、实时数据订阅可靠性（WS 重复订阅还会放大服务器压力）
- 修复建议（已落地）：
  - WebSocket：订阅 effect 的依赖项不应绑定回调函数 identity（回调已通过 ref 解决闭包），改为只依赖“是否开启该回调”的布尔值
    - [useWebSocket.ts](file:///workspace/frontend/src/hooks/useWebSocket.ts#L29-L112)
  - Table：columns/pagination 等 props memoize，避免 antd 内部在 effect 中 setState 形成自激循环
    - [GameTable.tsx](file:///workspace/frontend/src/components/tables/GameTable.tsx)
    - [BetTable.tsx](file:///workspace/frontend/src/components/tables/BetTable.tsx)
    - [LogTable.tsx](file:///workspace/frontend/src/components/tables/LogTable.tsx)
  - Modal：在 `visible=false` 时不渲染组件（避免 antd Modal 在 open=false 时仍触发内部状态机循环）
    - [DashboardPage.tsx](file:///workspace/frontend/src/pages/DashboardPage.tsx#L250-L520)
