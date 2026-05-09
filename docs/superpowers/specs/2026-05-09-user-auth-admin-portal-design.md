# 用户登录 + 管理员后台隔离（含审计）设计稿

日期：2026-05-09  
范围：前端（React）+ 后端（FastAPI）+ 数据库（Postgres/Neon）  

## 背景

当前系统使用单一管理员 Token（`admin_token`）驱动所有 API 调用：普通用户无需登录即可进入前端并执行“上传/开奖”等操作；管理员入口与普通使用入口在同一前端体系里，存在以下问题：

- 权限边界不清：高危功能与日常功能同入口，误操作风险高（例如清库、配置、余额操作）。
- 不支持多用户：无法让多人以“用户身份”登录使用系统，更无法对操作行为追责。
- 审计缺失：无法准确回答“谁在什么时候上传了哪些数据/点了开奖/做了配置变更”。

目标是引入“用户登录 + 管理员后台”分离的权限模型，并对关键操作进行审计。

## 目标

- 进入前端链接默认展示登录页，必须登录后才能使用系统。
- 支持两类身份：
  - 普通用户：可操作（上传、开奖、查看数据等），但不可使用管理员能力。
  - 管理员：可使用管理员控制台，并可返回前台使用系统；同时具备全部权限。
- 右上角“管理员”按钮：
  - 普通用户点击后需要进行管理员二次登录；
  - 管理员已登录则直接进入管理员控制台。
- 关键操作审计（A 选项）：记录操作者（用户/管理员）、账号、时间、行为、关联局号/靴号等。
- 不改变业务核心流程（上传→分析→下注→开奖→结算→复盘→下一局）。

## 非目标

- 不引入第三方 OAuth（GitHub/Google 等），仍使用账号密码。
- 不做复杂 RBAC（角色多级细分），仅区分 user/admin 两级。
- 不实现“仅靠一个前端确认框即可在生产环境直接清库”的弱保护方案。

## 总体方案（推荐）

### 方案选择

采用“一个前端项目 + 两类 Token + 后端强制鉴权依赖”的方案：

- 前端仍是同一个站点（`/login`、`/dashboard`、`/admin`）。
- 后端发放两类 JWT：
  - `user_token`：普通用户登录后获得。
  - `admin_token`：管理员登录后获得。
- 后端通过 `role` claim 做强校验：
  - `get_current_user()`：允许 `role in ["user", "admin"]`（前台业务 API）。
  - `get_current_admin()`：仅允许 `role == "admin"`（后台管理 API）。

该方案的优点：实现成本低、维护简单、体验一致，同时权限边界清晰。

## 认证与授权设计

### JWT 载荷建议

后端签发 JWT 时增加以下字段：

- `sub`: 用户名（username）
- `role`: `user` / `admin`
- `uid`: 用户表主键（普通用户为 users.id；管理员为 admin_users.id）
- `exp`: 过期时间（沿用现有 `JWT_EXPIRE_HOURS`）

### Token 存储与前端策略

前端 localStorage：

- `user_token`
- `admin_token`

规则：

- 访问 `/dashboard/**` 必须存在 `user_token` 或 `admin_token`。
- 访问 `/admin/**` 必须存在 `admin_token`。
- “管理员”按钮点击：
  - 若已有 `admin_token`：直接跳转 `/admin`；
  - 若无：弹管理员登录框，成功后写入 `admin_token` 并跳转 `/admin`。

### 后端依赖函数

新增依赖：

- `get_current_user()`：
  - 验证 JWT；
  - 检查 `role` ∈ {`user`,`admin`}；
  - 返回结构：`{ "role": ..., "uid": ..., "username": ... }`。
- `get_current_admin()`：
  - 验证 JWT；
  - 检查 `role == "admin"`；
  - 返回同上结构。

并将所有管理类路由从 `Depends(get_current_user)` 切换为 `Depends(get_current_admin)`。

## 数据模型设计

### 新增 users 表

字段建议：

- `id` (PK)
- `username` (unique)
- `password_hash`（bcrypt）
- `is_active`（bool，默认 true）
- `must_change_password`（可选，默认 false）
- `login_attempts`、`locked_until`（可复用管理员逻辑，可选）
- `created_at`、`updated_at`

### 管理员用户管理

沿用现有 `admin_users` 表作为管理员身份源。

新增管理员 API 进行 users 表管理：

- `POST /api/admin/users`：创建用户（username + password）
- `GET /api/admin/users`：用户列表（分页）
- `PATCH /api/admin/users/{id}`：
  - 启用/禁用（is_active）
  - 重置密码（password）
  - 强制改密（must_change_password）

## 审计设计（A）

### 审计落点

当前审计载体建议复用 `system_logs`（`system_logs` 已具备时间/靴号/局号/事件类型/描述等字段）。

为 `system_logs` 增加操作者字段：

- `actor_role`：`user` / `admin`
- `actor_uid`：int
- `actor_username`：str

记录策略：

- 普通业务高频操作（必须记录）：
  - 上传数据（Upload）
  - 开奖（Reveal）
- 管理类操作（必须记录）：
  - 模式切换
  - AI 模板与 API 配置变更
  - 维护操作（retention/run、reset-all 等，即便生产禁用也要记录尝试与拒绝）
  - 用户管理（新增/禁用/重置密码）

实现方式：

- 将当前写日志方法统一接收 actor 参数；
- actor 来源于 `Depends(get_current_user/get_current_admin)` 的返回值；
- 日志描述中可补充“操作者：xxx（role）”用于快速检索。

## API 变更

### 新增：普通用户登录

- `POST /api/auth/login`
  - body：`{ "username": "...", "password": "..." }`
  - response：`{ "token": "...", "username": "...", "must_change_password": false }`

### 调整：管理员登录

当前管理员登录为 `POST /api/admin/login` 且只收 password，且固定 username=admin。

调整为：

- `POST /api/admin/login`
  - body：`{ "username": "...", "password": "..." }`
  - response 同上 + `role: "admin"`

兼容策略：

- 可以保留旧字段一段时间（若 body 仅包含 password，则默认 username=admin），但前端全面切换到新请求格式。

### 管理接口保护

将管理相关路由全部要求 `Depends(get_current_admin)`，例如：

- `/api/admin/maintenance/*`
- `/api/admin/database-records`
- `/api/admin/api-config*`
- `/api/admin/prompt-templates/*`
- `/api/admin/ai-learning/*`
- `/api/admin/model-versions`
- 新增的 `/api/admin/users*`

业务接口允许 user/admin：

- `/api/games/*`
- `/api/analysis/*`
- `/api/bets`
- `/api/logs`
- `/api/roads`
- `/api/stats`

## 生产环境清空策略（增补）

### 目标

管理员在生产环境中应保留“全量清空数据”的最终权限，但不能是一键直达。该能力必须在已有管理员登录态之外，再做一次高风险操作确认，降低误触、借用已登录设备、长时间未退出后台等场景下的清库风险。

### 方案选择

采用方案 B：再次输入管理员密码。

不采用“仅弹确认框”是因为保护太弱；不采用“确认词”是因为确认词一旦固定，很容易在团队内部口头传播，长期看安全性不如再次校验当前管理员密码。

### 前端交互

管理员页面点击“清空演示数据”后：

- 非生产环境：
  - 保持当前轻量确认流程，可直接执行清空。
- 生产环境：
  - 弹出二次确认对话框；
  - 对话框中展示明确警告文案，例如“你正在清空生产环境数据，此操作不可恢复”；
  - 要求管理员再次输入当前管理员密码；
  - 未输入时不允许提交；
  - 提交后调用后端清空接口，并额外携带 `confirm_password` 字段。

前端错误提示要明确区分：

- 未输入确认密码；
- 确认密码错误；
- 仍有后台任务未停止；
- 生产环境禁止条件未满足；
- 其他服务端错误。

### 后端接口行为

接口仍使用现有：

- `POST /api/admin/maintenance/reset-all`

请求体扩展为可选字段：

- `confirm_password: string | null`

执行规则：

- 非生产环境：
  - 可忽略 `confirm_password`；
  - 维持当前便捷行为。
- 生产环境：
  - 若缺少 `confirm_password`，返回 `400`，提示“生产环境清空需要再次输入管理员密码确认”；
  - 若 `confirm_password` 错误，返回 `401`，提示“确认密码错误”；
  - 若密码正确，则继续执行原有的取消后台任务、清表、重置系统状态逻辑。

### 校验方式

生产环境下，后端使用当前管理员账号的 `password_hash` 与 `confirm_password` 做 bcrypt 校验：

- 当前请求仍需先通过 `Depends(get_current_admin)`；
- 然后根据 JWT 中的管理员身份（优先取 `actor.username`，默认兼容 `admin`）查询 `admin_users`；
- 使用 bcrypt 校验 `confirm_password`；
- 只有管理员 JWT 与确认密码同时成立，才允许执行清空。

这意味着清空动作采用“双重校验”：

- 第一层：管理员已登录；
- 第二层：管理员再次输入当前密码。

### 审计要求

无论是否清空成功，生产环境的清空尝试都应写入审计日志：

- 尝试人：`actor_role / actor_uid / actor_username`
- 动作：`ADMIN-RESET-ALL`
- 结果：
  - `REJECTED`（未提供确认密码 / 确认密码错误 / 后台任务未停）
  - `OK`（清空成功）
- 描述中应包含失败原因或成功摘要。

这样后续可以明确追踪：

- 谁尝试过清空生产数据；
- 是因密码错误被拒绝，还是确实执行成功；
- 当时系统是否存在后台任务。

### 测试要求

后端测试新增覆盖：

- 非生产环境：不传 `confirm_password` 也能清空；
- 生产环境：不传 `confirm_password` 返回 `400`；
- 生产环境：错误 `confirm_password` 返回 `401`；
- 生产环境：正确 `confirm_password` 返回 `200` 且完成清表；
- 审计日志记录成功与失败两类结果。

前端测试新增覆盖：

- 生产环境下点击按钮会出现密码确认弹窗；
- 输入密码后请求体包含 `confirm_password`；
- 后端返回密码错误时，界面展示明确提示；
- 非生产环境下不强制弹出密码确认弹窗。

## WebSocket 鉴权

前端现有 ws 鉴权发送 `{ type: "auth", token }`。

调整为：

- token 来源优先级：`admin_token` > `user_token`
- 后端 ws 鉴权解析同 JWT，允许 user/admin 订阅业务事件。
- 管理类事件（如维护告警、配置变更提示）可选择只推送 admin（后续可做）。

## 前端路由与页面

### 新增登录页

- `/login`
  - Tab：用户登录 / 管理员登录
  - 用户登录成功：写入 `user_token` → 进入 `/dashboard`
  - 管理员登录成功：写入 `admin_token` → 进入 `/admin`（并可返回 dashboard）

### 路由守卫

- `RequireUserOrAdminAuth`：保护 `/dashboard/**`
- `RequireAdminAuth`：保护 `/admin`

### 现有页面调整

当前代码中 `/admin` 已通过 `RequireAuth`（使用 `admin_token`）保护；需要：

- 将 dashboard 系列路由也加登录门禁；
- 将 `mode_selected` 的逻辑从“是否 admin_token 存在”改为“是否存在任意 token”；
- 管理员入口按钮逻辑改为“无 admin_token 弹管理员登录”。

## 迁移与上线策略

### 数据迁移（Postgres）

- Alembic 新增 migration：
  - 创建 `users` 表；
  - `system_logs` 增加三列 actor 字段（允许 null，避免历史数据迁移成本）。

### 初始用户

- 管理员通过后台创建普通用户；
- 或提供一次性“初始化用户”脚本/接口（仅非生产环境开启）；
- 生产环境不提供“匿名使用”，必须登录。

### 回滚策略

- 保留现有 admin 登录与 token 机制；
- 新增能力不影响已有业务流程；
- 若登录门禁导致生产不可用，可通过临时环境变量开关恢复匿名访问（建议作为应急开关设计，默认关闭）。

## 测试计划

- 后端单测：
  - user/admin 登录成功与失败、锁定逻辑；
  - `get_current_user`/`get_current_admin` 权限矩阵；
  - 关键业务接口在 user token 下可用；
  - 管理接口在 user token 下为 403；
  - `system_logs` 审计字段写入正确（上传/开奖/配置变更）。
- 前端测试：
  - 未登录访问 `/dashboard` 重定向 `/login`；
  - 用户登录后可进入 dashboard 并上传/开奖；
  - 点击管理员按钮弹管理员登录；登录成功跳转 `/admin`；
  - admin token 存在时可直接进入 `/admin`。
