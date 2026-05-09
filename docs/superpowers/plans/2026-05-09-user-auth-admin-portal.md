# 用户登录 + 管理员后台隔离（含审计）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 前端必须登录后才能使用系统；普通用户可上传/开奖等“使用功能”，管理员拥有独立后台与全部权限；关键操作写入审计信息。

**Architecture:** 单一前端站点提供 `/login`、`/dashboard`、`/admin`；后端发两类 JWT（user/admin），通过依赖函数强制权限；审计信息写入 `system_logs`（新增 actor 字段），并由请求上下文自动填充。

**Tech Stack:** React + TypeScript（前端），FastAPI + SQLAlchemy Async（后端），Postgres/Neon + Alembic（迁移），JWT（python-jose），bcrypt。

---

## 代码结构定位（实施前先熟悉）

**后端**
- 认证工具：`/workspace/backend/app/api/routes/utils.py`
- 管理员认证与配置：`/workspace/backend/app/api/routes/auth.py`（路由前缀 `/api/admin`）
- 业务路由：`/workspace/backend/app/api/routes/game.py`（上传/开奖等当前依赖 `get_current_user`）
- 写日志：`/workspace/backend/app/services/game/logging.py`（`write_game_log`）
- 数据模型：`/workspace/backend/app/models/schemas.py`
- 迁移：`/workspace/backend/alembic/versions/*.py`

**前端**
- API 封装：`/workspace/frontend/src/services/api.ts`（当前仅 `admin_token`）
- 路由：搜索 `Routes`/`createBrowserRouter`（按项目现状调整）
- 管理员页：`/workspace/frontend/src/pages/AdminPage.tsx`

---

### Task 1: 数据模型与迁移（users + system_logs 审计字段）

**Files:**
- Modify: `backend/app/models/schemas.py`
- Create: `backend/alembic/versions/20260509_0007_users_and_log_actor.py`

- [ ] **Step 1: 为 system_logs 增加审计字段（模型层）**

在 `SystemLog` 模型新增三列（允许为空，兼容历史数据）：

```python
actor_role = Column(String(20), nullable=True)
actor_uid = Column(Integer, nullable=True)
actor_username = Column(String(64), nullable=True)
```

- [ ] **Step 2: 新增 User 模型（users 表）**

在 `schemas.py` 新增：

```python
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String(64), unique=True, index=True, nullable=False)
    password_hash = Column(String(128), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    must_change_password = Column(Boolean, default=False, nullable=False)
    login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

- [ ] **Step 3: 写 Alembic migration（创建 users + 修改 system_logs）**

创建版本文件 `20260509_0007_users_and_log_actor.py`：

```python
from alembic import op
import sqlalchemy as sa

revision = "20260509_0007"
down_revision = "20260508_0006"

def upgrade():
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(length=64), nullable=False),
        sa.Column("password_hash", sa.String(length=128), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("must_change_password", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("login_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("locked_until", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("username", name="uq_users_username"),
    )
    op.create_index("ix_users_username", "users", ["username"], unique=True)

    op.add_column("system_logs", sa.Column("actor_role", sa.String(length=20), nullable=True))
    op.add_column("system_logs", sa.Column("actor_uid", sa.Integer(), nullable=True))
    op.add_column("system_logs", sa.Column("actor_username", sa.String(length=64), nullable=True))

def downgrade():
    op.drop_column("system_logs", "actor_username")
    op.drop_column("system_logs", "actor_uid")
    op.drop_column("system_logs", "actor_role")
    op.drop_index("ix_users_username", table_name="users")
    op.drop_table("users")
```

- [ ] **Step 4: 运行迁移验证**

Run: `python -m alembic -c backend/alembic.ini upgrade head`  
Expected: SUCCESS

- [ ] **Step 5: 提交**

```bash
git add backend/app/models/schemas.py backend/alembic/versions/20260509_0007_users_and_log_actor.py
git commit -m "feat(auth): add users table and audit fields for system logs"
```

---

### Task 2: 请求上下文审计注入（避免改动所有 write_game_log 调用点）

**Files:**
- Create: `backend/app/core/request_context.py`
- Modify: `backend/app/api/routes/utils.py`
- Modify: `backend/app/services/game/logging.py`

- [ ] **Step 1: 新增 request_context（ContextVar 保存当前操作者）**

`request_context.py`：

```python
from contextvars import ContextVar

current_actor: ContextVar[dict | None] = ContextVar("current_actor", default=None)

def set_current_actor(actor: dict | None):
    current_actor.set(actor)

def get_current_actor() -> dict | None:
    return current_actor.get()
```

- [ ] **Step 2: 在 get_current_user/get_current_admin 中写入 actor**

将 `utils.py` 改造为：
- `decode_token` 返回 payload
- `get_current_user` 校验 role in {user, admin}
- 新增 `get_current_admin` 校验 role == admin
- 在返回前调用 `set_current_actor({"role":..., "uid":..., "username":...})`

关键片段（示例）：

```python
from app.core.request_context import set_current_actor

def parse_actor(payload: dict) -> dict:
    return {"role": payload.get("role"), "uid": payload.get("uid"), "username": payload.get("sub")}
```

- [ ] **Step 3: write_game_log 自动补齐 actor 字段**

在 `app/services/game/logging.py` 的 `write_game_log` 创建 `SystemLog` 时：

```python
from app.core.request_context import get_current_actor

actor = get_current_actor()
if actor:
    log.actor_role = actor.get("role")
    log.actor_uid = actor.get("uid")
    log.actor_username = actor.get("username")
```

- [ ] **Step 4: 回归测试（不涉及接口改动的单测先跑一遍）**

Run: `python -m pytest backend/tests/test_task_registry_integration.py -q`  
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add backend/app/core/request_context.py backend/app/api/routes/utils.py backend/app/services/game/logging.py
git commit -m "feat(audit): inject actor into system logs via request context"
```

---

### Task 3: 认证 API（用户登录 + 管理员登录升级为 username/password）

**Files:**
- Modify: `backend/app/api/routes/schemas.py`
- Modify: `backend/app/api/routes/auth.py`
- Create: `backend/app/api/routes/user_auth.py`
- Modify: `backend/app/api/main.py`（注册新 router）

- [ ] **Step 1: 新增用户登录请求模型**

在 `schemas.py` 新增：

```python
class UserLoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=1, max_length=128)

class AdminLoginRequest(BaseModel):
    username: str | None = None
    password: str = Field(..., min_length=1, max_length=128)
```

并保留旧 `LoginRequest` 或直接替换 `LoginRequest` 为 `AdminLoginRequest`，但需要兼容“仅传 password”的老客户端：
- 当 `username is None` 时默认 `"admin"`

- [ ] **Step 2: 新增 `/api/auth/login`（普通用户登录）**

创建 `user_auth.py`（`APIRouter(prefix="/api/auth")`），实现：
- 校验用户名存在、is_active、lock 逻辑
- bcrypt 校验
- 签发 JWT：`{"sub": username, "role": "user", "uid": user.id, "exp": ...}`

返回：

```json
{ "token": "...", "username": "...", "must_change_password": false }
```

- [ ] **Step 3: 改造 `/api/admin/login` 支持 username/password**

在 `auth.py`：
- 根据 req.username（默认 admin）查询 `AdminUser`
- 签发 JWT：`{"sub": admin.username, "role":"admin", "uid": admin.id, "exp": ...}`
- 仍保留原有锁定/剩余次数提示逻辑

- [ ] **Step 4: 将 `/api/admin/**` 保护依赖改为 get_current_admin**

在 `auth.py` 内，诸如：
- `/change-password`
- `/model-versions`
- `/prompt-templates/single-ai`
等所有管理接口，将 `Depends(get_current_user)` 改为 `Depends(get_current_admin)`

- [ ] **Step 5: 注册新 router**

在 `app/api/main.py` 加：

```python
from app.api.routes.user_auth import router as user_auth_router
app.include_router(user_auth_router)
```

- [ ] **Step 6: 后端接口验收（用 curl/脚本）**

验证用户登录：

```bash
python - <<'PY'
import json, urllib.request
base="https://bbbbb-backend.onrender.com"
req=urllib.request.Request(base+"/api/auth/login", data=json.dumps({"username":"u1","password":"p1"}).encode(), headers={"Content-Type":"application/json"})
print(urllib.request.urlopen(req, timeout=30).read().decode())
PY
```

Expected: 200 + token（先用 admin 创建 u1 后再测）

- [ ] **Step 7: 提交**

```bash
git add backend/app/api/routes/schemas.py backend/app/api/routes/auth.py backend/app/api/routes/user_auth.py backend/app/api/main.py
git commit -m "feat(auth): add user login and role-based admin login"
```

---

### Task 4: 用户管理 API（管理员专用）

**Files:**
- Create: `backend/app/api/routes/user_admin.py`
- Modify: `backend/app/api/main.py`
- Modify: `backend/app/api/routes/schemas.py`
- Test: `backend/tests/test_user_auth_and_admin_users.py`

- [ ] **Step 1: 新增 Pydantic 模型**

在 `schemas.py` 新增：

```python
class AdminCreateUserRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=4, max_length=128)

class AdminUpdateUserRequest(BaseModel):
    is_active: bool | None = None
    password: str | None = Field(None, min_length=4, max_length=128)
    must_change_password: bool | None = None
```

- [ ] **Step 2: 新增 `/api/admin/users` 路由**

`user_admin.py`（`prefix="/api/admin"`, `Depends(get_current_admin)`）：
- `POST /users`：创建用户（bcrypt hash）
- `GET /users`：分页列表（id/username/is_active/created_at）
- `PATCH /users/{id}`：启用禁用/重置密码/强制改密

- [ ] **Step 3: 注册 router**

在 `main.py` include：

```python
from app.api.routes.user_admin import router as user_admin_router
app.include_router(user_admin_router)
```

- [ ] **Step 4: 写后端测试（最小但覆盖权限矩阵）**

`test_user_auth_and_admin_users.py`：
- admin_token 能创建用户
- user_token 访问 `/api/admin/users` 为 403
- 无 token 为 401
- 新用户能 `/api/auth/login` 成功

示例断言：

```python
assert resp.status_code == 403
```

- [ ] **Step 5: 运行测试**

Run: `python -m pytest backend/tests/test_user_auth_and_admin_users.py -q`  
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add backend/app/api/routes/user_admin.py backend/app/api/main.py backend/app/api/routes/schemas.py backend/tests/test_user_auth_and_admin_users.py
git commit -m "feat(admin): add user management endpoints"
```

---

### Task 5: 前端登录页 + 路由守卫 + 管理员二次登录

**Files:**
- Modify: `frontend/src/services/api.ts`
- Create: `frontend/src/pages/LoginPage.tsx`
- Modify: `frontend/src/App.tsx`（或现有路由文件）
- Modify: `frontend/src/pages/DashboardPage.tsx`（管理员按钮触发逻辑）
- Modify: `frontend/src/pages/AdminPage.tsx`（允许从 admin 返回 dashboard）

- [ ] **Step 1: token 工具与 api 拦截改造**

在 `api.ts`：
- 增加 `USER_TOKEN_KEY = "user_token"`、`ADMIN_TOKEN_KEY = "admin_token"`
- 根据请求路径决定 token：
  - 以 `/api/admin/` 开头：用 admin_token
  - 否则：优先 user_token，不存在则 fallback admin_token

示例：

```ts
const isAdmin = config.url?.includes('/api/admin/')
const token = isAdmin ? getAdminToken() : (getUserToken() ?? getAdminToken())
```

- [ ] **Step 2: 新增 LoginPage（用户/管理员两种登录）**

`LoginPage.tsx`：
- Tab：用户登录 / 管理员登录
- 用户登录调用 `/api/auth/login`
- 管理员登录调用 `/api/admin/login`
- 成功后写 token 并跳转：
  - user → `/dashboard`
  - admin → `/admin`

- [ ] **Step 3: 路由守卫**

实现：
- 未登录访问 `/dashboard/**` → 跳 `/login`
- 未 admin_token 访问 `/admin` → 跳 `/login`（并默认选中管理员登录 tab）

- [ ] **Step 4: Dashboard 右上角管理员按钮二次登录**

Dashboard 头部管理员按钮逻辑：
- 已 admin_token：`navigate("/admin")`
- 无 admin_token：弹管理员登录 modal（可复用现有管理员登录组件，登录成功后保存 admin_token 并跳转 `/admin`）

- [ ] **Step 5: 前端测试**

Run: `cd frontend && npm test`  
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add frontend/src/services/api.ts frontend/src/pages/LoginPage.tsx frontend/src/App.tsx frontend/src/pages/DashboardPage.tsx frontend/src/pages/AdminPage.tsx
git commit -m "feat(frontend): add user login gate and admin escalation flow"
```

---

### Task 6: 管理员端新增“用户管理”页面（UI）

**Files:**
- Modify: `frontend/src/pages/AdminPage.tsx`
- Create: `frontend/src/components/admin/UserManagement.tsx`
- Modify: `frontend/src/services/api.ts`（若需要新增 typed API 方法）

- [ ] **Step 1: 新增 UserManagement 组件**

包含：
- 用户列表（分页）
- 新增用户弹窗（username/password）
- 启用/禁用切换
- 重置密码（管理员输入新密码）

对应调用：
- `GET /api/admin/users`
- `POST /api/admin/users`
- `PATCH /api/admin/users/{id}`

- [ ] **Step 2: AdminPage 增加 Tab “用户管理” 并挂载组件**

保持现有 `AI设置/处理/数据库` 结构不变，新增一个 tab。

- [ ] **Step 3: 前端自测**

在浏览器：
- admin 登录进入 `/admin`
- 创建用户 u1/p1
- 退出 admin，去 `/login` 用户登录 u1/p1 进入 `/dashboard`

- [ ] **Step 4: 提交**

```bash
git add frontend/src/pages/AdminPage.tsx frontend/src/components/admin/UserManagement.tsx
git commit -m "feat(admin-ui): add user management page"
```

---

### Task 7: 审计验收（上传/开奖/配置修改都能记录操作者）

**Files:**
- Modify: `backend/app/services/game/logging.py`
- Test: `backend/tests/test_audit_actor_fields.py`

- [ ] **Step 1: 写后端测试：上传/开奖写入 actor 字段**

思路：
- 先用 admin 创建用户 u1
- user 登录拿 token
- 调用 `/api/games/upload`、`/api/games/reveal`
- 再调用 `/api/logs` 确认最新日志的 `actor_username == "u1"` 且 `actor_role == "user"`

- [ ] **Step 2: 跑测试**

Run: `python -m pytest backend/tests/test_audit_actor_fields.py -q`  
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add backend/tests/test_audit_actor_fields.py
git commit -m "test(audit): verify actor fields recorded for user actions"
```

---

### Task 8: 线上回归与发布

**Files:**
- Modify: 无（以部署配置为主）

- [ ] **Step 1: 本地回归**

Run:
- `python -m pytest backend/tests -q`
- `cd frontend && npm test && npm run build`

- [ ] **Step 2: 合并到 main 并推送**

```bash
git checkout main
git merge <feature-branch>
git push origin main
```

- [ ] **Step 3: Render 自动部署确认**

在 Render 后台确认：
- `New commit via Auto-Deploy` 出现
- Deploy live

- [ ] **Step 4: 线上验收脚本**

验收点：
- 未登录访问 `/dashboard` → 跳 `/login`
- admin 创建 user
- user 登录 → 上传/开奖成功
- user 点击管理员 → 要求管理员二次登录
- `system_logs` 可看到 actor 字段

---

## 自检（覆盖 spec）

- spec “两类 token + role/uid” → Task 2/3/5
- spec “users 表 + 用户管理” → Task 1/4/6
- spec “审计（A）” → Task 2/7
- spec “前端登录门禁 + 管理员二次登录” → Task 5
- spec “管理接口必须 admin” → Task 3/4

---

## 执行方式选择

计划已保存到 `docs/superpowers/plans/2026-05-09-user-auth-admin-portal.md`。两种执行方式：

1. **Subagent-Driven（推荐）**：每个 Task 启一个子代理实现并复核，迭代快、风险低  
2. **Inline Execution**：我在当前会话按 Task 顺序直接改代码并跑测试

你选 1 还是 2？

