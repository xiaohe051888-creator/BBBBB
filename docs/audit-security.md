# BBBBB 安全漏洞审计报告

**审计日期**: 2026-04-10  
**审计范围**: `/BBBBB` 项目全代码（后端 Python + 前端 React/TypeScript）  
**审计版本**: v2.3.0  
**审计工具**: 手动代码审计 + 模式匹配扫描  

---

## 一、审计摘要

| 严重程度 | 数量 | 状态 |
|---------|------|------|
| 🔴 Critical | 3 | 待修复 |
| 🟠 High | 4 | 待修复 |
| 🟡 Medium | 6 | 建议修复 |
| 🔵 Low | 4 | 可选修复 |
| **合计** | **17** | |

### 关键发现
1. **真实 API 密钥泄露在 .env 文件中**（已提交到 Git 仓库）
2. **大多数 API 端点无认证保护**，任何人可操作游戏流程
3. **WebSocket 允许无认证连接**，可接收所有实时推送数据
4. JWT Secret 使用弱默认值
5. 无速率限制（Rate Limiting）机制
6. 新密码无强度校验

---

## 二、详细漏洞列表

### 🔴 Critical - 严重

#### C-01: 真实 API 密钥泄露在代码仓库中
- **文件**: `backend/.env` (第16-33行)
- **风险描述**: 真实的 AI API 密钥（ofox.ai 代理密钥）直接存储在 `.env` 文件中。虽然 `.gitignore` 中有 `.env` 规则，但该文件已被 Git 跟踪且可在仓库中访问。密钥值 `sk-of-tbzTTqZAfVGqCphuORHuLwFHHTdJQmDCOaZkzYgxFmsmFSwxJdLgcMnkbopOlCvk` 被三个 API 配置共用。
- **影响**: 攻击者可直接使用泄露的密钥调用 OpenAI、Anthropic、Gemini 等 AI 服务，产生大量费用或滥用 API 配额。
- **CVSS**: 9.1 (Critical)
- **修复建议**:
  1. **立即轮换泄露的 API 密钥**
  2. 从 Git 历史中彻底清除 `.env` 文件（`git filter-branch` 或 `BFG Repo-Cleaner`）
  3. 确保 `.env` 从未被提交到远程仓库
  4. 使用 Vault 或环境变量注入方式管理密钥

#### C-02: 大量 API 端点缺少认证保护
- **文件**: `backend/app/api/main.py`
- **受影响端点**:
  - `POST /api/games/upload` (第514行) - 任何人可上传开奖记录
  - `POST /api/games/bet` (第559行) - 任何人可下注
  - `POST /api/games/reveal` (第579行) - 任何人可开奖结算
  - `GET /api/games/deep-learning-status` (第640行)
  - `GET /api/games/current-state` (第656行)
  - `GET /api/games` (第665行) - 泄露所有开奖记录
  - `GET /api/bets` (第715行) - 泄露所有下注记录
  - `GET /api/logs` (第764行) - 泄露所有系统日志
  - `GET /api/stats` (第820行) - 泄露统计数据
  - `GET /api/roads` (第868行) - 泄露走势图数据
  - `GET /api/roads/raw` (第955行)
  - `GET /api/analysis/latest` (第989行) - 泄露 AI 分析结果
  - `GET /api/system/state` (第165行)
  - `GET /api/system/health` (第212行)
  - `GET /api/system/diagnostics` (第362行) - **暴露 API Key 配置状态**
- **风险描述**: 上述端点均未使用 `Depends(get_current_user)` 进行认证检查。任何能访问后端端口的人都可以读取全部游戏数据、修改游戏状态、执行下注操作。`/api/system/diagnostics` 尤其危险，会暴露 AI 模型是否已配置等敏感信息。
- **CVSS**: 9.8 (Critical)
- **修复建议**:
  1. 对所有操作类端点（upload/bet/reveal/end-boot）添加 `Depends(get_current_user)` 认证
  2. 对数据查询端点至少添加只读认证或 API Key 验证
  3. `/api/system/diagnostics` 应限制为管理员专用

#### C-03: JWT Secret Key 使用弱默认值
- **文件**: `backend/app/core/config.py` (第20行)
- **代码**: `JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "change-me-in-production")`
- **实际值**: `.env` 中配置为 `your-super-secret-key-change-this-in-production`，这仍然是弱密钥
- **风险描述**: JWT Secret 过于简单且可预测，攻击者可伪造 JWT Token，绕过所有认证保护，以管理员身份访问系统。
- **CVSS**: 9.1 (Critical)
- **修复建议**:
  1. 生成至少 256 位的随机密钥（`openssl rand -hex 32`）
  2. 在生产环境强制要求从环境变量加载，不提供默认值
  3. 定期轮换 JWT Secret

---

### 🟠 High - 高危

#### H-01: WebSocket 连接允许无认证访问
- **文件**: `backend/app/api/main.py` (第1314-1336行)
- **代码**:
  ```python
  @app.websocket("/ws/{table_id}")
  async def websocket_endpoint(websocket: WebSocket, table_id: str):
      token = websocket.query_params.get("token")
      if token:
          try:
              jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
          except (JWTError, Exception):
              await websocket.close(code=4001, reason="无效的认证凭证")
              return
      await websocket.accept()  # 无 token 时仍然接受连接！
  ```
- **风险描述**: WebSocket 端点在有 token 时验证，但**没有 token 时直接允许连接**。攻击者无需任何认证即可连接 WebSocket，接收所有实时游戏数据推送（下注信息、开奖结果、AI 分析结果、资金变动等）。
- **CVSS**: 7.5 (High)
- **修复建议**: 将 token 验证改为必须条件，无 token 时拒绝连接。

#### H-02: 无速率限制（Rate Limiting）机制
- **文件**: 全局（`backend/app/api/main.py`）
- **风险描述**: 所有 API 端点均无速率限制。攻击者可：
  - 对登录接口进行暴力破解（虽然代码有 5 次锁定机制，但每个 JWT session 有 24 小时有效期）
  - 大量调用 AI 分析接口消耗 API 额度和费用
  - 通过批量请求造成 DoS
- **CVSS**: 7.5 (High)
- **修复建议**:
  1. 引入 `slowapi` 或自定义中间件实现速率限制
  2. 登录接口限制为 5次/分钟/IP
  3. AI 分析接口限制为 10次/分钟
  4. 一般 API 接口限制为 60次/分钟

#### H-03: 修改密码无强度校验
- **文件**: `backend/app/api/main.py` (第1127-1151行)
- **风险描述**: `ChangePasswordRequest` 模型仅要求 `old_password` 和 `new_password` 为字符串，无最小长度、复杂度等校验。管理员可将密码设为 "1" 等极弱密码。
- **CVSS**: 6.5 (Medium-High)
- **修复建议**:
  1. 添加密码强度验证器：最小 8 位，包含大小写字母和数字
  2. 拒绝与旧密码相同的密码
  3. 添加常见弱密码黑名单检查

#### H-04: CORS 配置 allow_headers=["*"]
- **文件**: `backend/app/api/main.py` (第134-140行)
- **代码**: `allow_headers=["*"]`
- **风险描述**: 允许所有请求头跨域传递。虽然 `allow_origins` 有白名单限制（非 `*`），但 `allow_headers=["*"]` 配合 `allow_credentials=True` 可能导致安全风险，特别是如果未来 origins 配置不当。
- **CVSS**: 6.1 (Medium)
- **修复建议**: 显式列出允许的请求头：`["Authorization", "Content-Type"]`

---

### 🟡 Medium - 中危

#### M-01: 登录锁定机制仅基于用户名，未考虑 IP
- **文件**: `backend/app/api/main.py` (第1075-1124行)
- **风险描述**: 登录失败计数和锁定是基于 `AdminUser` 记录（用户名）而非 IP 地址。攻击者可利用锁定机制进行账户锁定 DoS（故意输错 5 次密码使管理员无法登录），且同一个 IP 的多次暴力破解尝试不会被统一限制。
- **CVSS**: 5.3 (Medium)
- **修复建议**: 结合 IP 地址 + 用户名的双重维度进行锁定，增加 IP 维度的登录尝试记录。

#### M-02: 前端 JWT Token 存储在 localStorage
- **文件**: `frontend/src/services/api.ts` (第11-25行)
- **风险描述**: JWT Token 存储在 `localStorage` 中，容易受到 XSS 攻击窃取。如果攻击者在页面中注入恶意脚本，可以直接读取 `localStorage.getItem('admin_token')` 获取管理员凭证。
- **CVSS**: 5.0 (Medium)
- **修复建议**:
  1. 使用 `HttpOnly` + `Secure` Cookie 存储 Token（需后端配合）
  2. 如果必须使用 localStorage，确保所有用户输入经过严格消毒
  3. 设置较短的 Token 有效期并实现 refresh token 机制

#### M-03: 诊断接口泄露系统内部信息
- **文件**: `backend/app/api/main.py` (第362-453行)
- **端点**: `GET /api/system/diagnostics`
- **风险描述**: 该接口返回内存会话列表、WebSocket 连接数、AI 模型配置详情等内部信息。攻击者可利用这些信息了解系统架构和状态，为后续攻击做准备。
- **CVSS**: 5.3 (Medium)
- **修复建议**: 该接口应添加管理员认证保护。

#### M-04: Gemini API Key 通过 URL 查询参数传递
- **文件**: `backend/app/services/three_model_service.py` (第132行)
- **代码**: `params={"key": self.api_key}`
- **风险描述**: Gemini API 调用时，API Key 通过 URL 查询参数传递，可能被记录在访问日志、代理日志中，增加泄露风险。
- **CVSS**: 4.3 (Medium)
- **修复建议**: 如果 Gemini API 支持通过 Header 传递 Key，优先使用 Header 方式。

#### M-05: 错误信息泄露内部实现细节
- **文件**: `backend/app/api/main.py` (多处 catch 块)
- **示例**: 第277行 `f"数据库连接异常: {str(e)[:30]}"`，第397行 AI 分析异常详情
- **风险描述**: 部分错误处理将内部异常信息直接返回给前端，可能暴露数据库结构、文件路径、内部 API 调用细节等信息。
- **CVSS**: 4.3 (Medium)
- **修复建议**: 对外返回通用错误信息，详细错误仅记录在服务端日志中。

#### M-06: SPA 回退路由缺少路径遍历防护
- **文件**: `backend/app/api/main.py` (第149-156行)
- **代码**:
  ```python
  @app.get("/{full_path:path}")
  async def spa_fallback(full_path: str):
      ...
      index_path = os.path.join(_static_dir, "index.html")
      if os.path.exists(index_path):
          return FileResponse(index_path)
  ```
- **风险描述**: 虽然代码检查了 `api/` 和 `ws` 前缀，但 `full_path` 直接来自用户请求。在生产环境中如果 static 目录结构变化，可能存在路径遍历风险。当前实现因为直接返回 `index.html` 而非用户指定的文件，实际风险较低。
- **CVSS**: 3.7 (Low-Medium)
- **修复建议**: 对 `full_path` 进行更严格的白名单校验，拒绝包含 `..` 的路径。

---

### 🔵 Low - 低危

#### L-01: Debug 模式配置可从环境变量切换
- **文件**: `backend/app/core/config.py` (第13行)
- **风险描述**: `DEBUG` 模式控制数据库 `echo` 输出等，若生产环境误开启可能泄露 SQL 查询细节。
- **CVSS**: 3.1 (Low)
- **修复建议**: 生产环境中硬编码 `DEBUG=False`，或通过独立的部署配置强制覆盖。

#### L-02: 密码修改后未使现有 Token 失效
- **文件**: `backend/app/api/main.py` (第1127-1151行)
- **风险描述**: 修改密码后，基于旧密码签发的 JWT Token 仍然有效（24 小时内），存在会话劫持窗口期。
- **CVSS**: 3.1 (Low)
- **修复建议**: 密码修改后记录 Token 黑名单或强制重新认证。

#### L-03: 前端 package.json 使用 ^ 版本范围
- **文件**: `frontend/package.json`
- **风险描述**: 依赖使用 `^` 范围（如 `"react": "^19.2.4"`），自动更新可能引入有安全漏洞的新版本。
- **CVSS**: 3.0 (Low)
- **修复建议**: 使用 `npm audit` 定期检查依赖漏洞；生产环境使用 lock 文件锁定版本。

#### L-04: scripts 目录包含数据库管理脚本
- **文件**: `scripts/` 目录
- **风险描述**: `scripts/` 目录包含 `init_db.py`、`fix_admin_password.py`、`unlock_admin.py`、`check_db.py` 等数据库管理脚本。虽然 `.gitignore` 已忽略 `scripts/*.py`，但这些脚本本身存在安全风险（如直接修改管理员密码、绕过认证）。
- **CVSS**: 2.0 (Low)
- **修复建议**: 确保这些脚本仅在受控环境中使用，不要在生产服务器上保留。

---

## 三、安全加固清单

### 立即修复（P0 - 本周内）
- [ ] **轮换泄露的 API 密钥**（C-01）
- [ ] **从 Git 历史清除 .env 文件**（C-01）
- [ ] **为所有敏感 API 端点添加认证**（C-02）
- [ ] **生成强随机 JWT Secret Key**（C-03）
- [ ] **修复 WebSocket 无认证连接问题**（H-01）

### 短期修复（P1 - 两周内）
- [ ] **引入速率限制中间件**（H-02）
- [ ] **添加密码强度验证**（H-03）
- [ ] **收紧 CORS allow_headers 配置**（H-04）
- [ ] **诊断接口添加认证保护**（M-03）
- [ ] **对外错误信息脱敏**（M-05）

### 中期修复（P2 - 一个月内）
- [ ] **登录锁定结合 IP 维度**（M-01）
- [ ] **Token 存储迁移到 HttpOnly Cookie**（M-02）
- [ ] **密码修改后使旧 Token 失效**（L-02）
- [ ] **Gemini API Key 改用 Header 传递**（M-04）

---

## 四、安全架构建议

### 1. 认证体系升级
```
当前: 仅管理员有 JWT 认证（部分端点）
建议: 引入操作者（Operator）角色，区分管理员和操作员权限
```

### 2. API 安全中间件
```
建议添加:
- 速率限制 (slowapi)
- 请求日志审计
- Helmet 类安全头设置
- HTTPS 强制（生产环境）
```

### 3. 数据安全
```
- 敏感数据（余额、下注记录）传输加密（HTTPS）
- 数据库连接字符串不硬编码
- 定期备份数据库
```

### 4. 监控与告警
```
- 异常登录检测
- API 调用异常频率检测
- AI API 调用量监控与告警
```

---

## 五、正面安全发现

系统在以下方面表现良好：

| 安全措施 | 说明 |
|---------|------|
| ✅ SQL 注入防护 | 全部数据库查询使用 SQLAlchemy ORM 参数化查询，未发现字符串拼接 SQL |
| ✅ XSS 防护 | 前端使用 React JSX（自动转义），未使用 `dangerouslySetInnerHTML`、`innerHTML`、`eval()` 等 |
| ✅ 命令注入防护 | 后端未使用 `eval()`、`exec()`、`os.system()`、`subprocess` 等命令执行函数 |
| ✅ 密码哈希 | 使用 bcrypt 进行密码哈希，而非明文存储 |
| ✅ JWT 实现 | 使用 python-jose + HS256 标准 JWT 实现 |
| ✅ 输入验证 | Pydantic 模型对请求参数进行类型和值校验 |
| ✅ 登录锁定 | 连续 5 次失败后锁定账户 10 分钟 |
| ✅ .gitignore 配置 | `.env` 文件已在 `.gitignore` 中排除 |
| ✅ 路径遍历防护 | SPA 回退路由检查 `api/`、`ws` 前缀 |
| ✅ 无文件上传漏洞 | 系统通过 JSON API 接收数据，无文件上传功能 |
| ✅ 依赖版本 | 后端使用固定版本号（`==`），前端虽使用 `^` 但有 lock 文件 |

---

## 六、审计结论

BBBBB 系统在基础安全防护方面表现良好（无 SQL 注入、无 XSS、无命令注入），但在**认证覆盖面**和**密钥管理**方面存在严重缺陷。

**最关键的问题是**：大量业务 API 端点（下注、开奖、上传等）完全无认证保护，任何人只要知道后端地址即可操作整个游戏流程。此外，真实 API 密钥泄露到代码仓库是另一个需要立即处理的安全事件。

建议按照上述加固清单的优先级逐步修复，优先处理 P0 级别的安全问题。

---

*审计人: Security Auditor (Agent)*  
*审计时间: 2026-04-10 20:00 CST*
