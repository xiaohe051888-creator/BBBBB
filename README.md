# 百家乐 AI 预测与自动托管系统

基于 React Web + FastAPI 打造的量化自动托管分析系统。本系统结合 **三路 AI 大模型** 与 **量化强规则引擎**，实现对博弈趋势的快速解析、自动下注与资金风控。

## 核心架构：双脑引擎驱动

系统通过管理员后台支持无缝切换“双脑”预测模式：

### 1. AI 三模型深度交叉分析（AI 模式）
- **庄模型（开放AI平台）**：偏向保守防守与长期趋势识别。
- **闲模型（克劳德平台）**：擅长短线反转与震荡区间嗅探。
- **综合模型（双子星平台）**：统筹决策，结合系统特有的**等待期微学习**与**错题本记忆**进行复盘进化。
- **机制**：通过高度结构化的提示词分析“大路”与“下三路”的红蓝特征，输出高维度的博弈预测。

### 2. 强规则量化引擎（强规则模式）
- **纯粹的数学量化**：摒弃 AI 幻觉，完全基于算法矩阵扫描。
- **动态权重进化**：根据本靴最近 20 局的“长龙”与“单跳”出现频率，自动微调得分权重。
- **防爆瞬断检测**：一旦识别到坚固的长龙规律被随机性瞬间打断（例如 5连庄后突开闲），引擎瞬间触发防守，暴扣追龙权重，拒绝无脑死磕。

---

## 核心机制与全托管原则

系统已从早期的“人工辅助工具”彻底进化为**“全自动托管交易机器”**。

### 全自动下注与零逃课
- **每局必下**：系统不允许用户“手动下注”或“跳过下注”。无论 AI 是给出明确方向，还是退缩给出“观望/非法结果”，系统后端都会执行**强制兜底下注**。
- **隔离污染**：如果是“强规则引擎”在运行，系统会从物理层面切断大模型的令牌消耗，绝不触发微学习和错题本，做到双脑 100% 物理隔离。

### 资金风控与熔断预警
- **风险具象化**：风险不再体现在“是否下注”，而是体现在“下注金额”的收缩（降级为“保守”层级）。
- **2000元软预警**：当系统余额 $\le 2000$ 时，前端弹出橙色低水位预警，且具备防频繁刷屏锁。
- **0元硬熔断**：当系统余额不足以下注时，触发**系统级熔断**（状态 = "余额不足"）。前端立刻封锁开奖按钮，禁止录入新数据，直到管理员前往后台执行“余额充值”。

---

## 技术栈与快速启动

### 方式一：一键全栈启动（推荐）
系统内置了完善的一键启动脚本，自动处理端口清理、依赖安装、构建以及服务健康检测。
```bash
./start-all.sh
```

### 方式二：Docker 容器化部署
支持基于 Docker Compose 的多阶段构建，完美隔离运行环境，自动挂载 SQLite 数据卷保证数据持久化。
```bash
docker compose up --build -d
```

### 方式二补充：使用 Postgres（推荐用于长期运行/云部署）

本项目后端支持通过 `DATABASE_URL` 使用 Postgres。

1) 启动服务（含 Postgres，见 docker-compose.yml）：

```bash
docker compose up --build -d
```

2) 本地迁移（SQLite → Postgres，一次性）：

```bash
SQLITE_URL="sqlite+aiosqlite:///${PWD}/backend/data/baccarat.db" \\
POSTGRES_URL="postgresql+asyncpg://baccarat:baccarat@localhost:5432/baccarat" \\
python backend/scripts/migrate_sqlite_to_postgres.py
```

迁移脚本会把核心业务表（状态、记录、下注、日志、错题本、五路缓存、记忆库、版本表）迁移到 Postgres。迁移完成后，生产环境只需要设置 `DATABASE_URL` 即可。

### 方式三：云端托管部署（Render）
项目根目录已包含 `render.yaml` 配置文件，支持在 Render 平台上一键部署双服务：
- **后端**：FastAPI Web 服务
- **前端**：静态站点（Vite 构建产物）

#### 部署步骤（中文）

1) 在 Render 绑定你的 GitHub 仓库，选择使用仓库内的 `render.yaml`。

2) 创建数据库：`baccarat-db`（Postgres 15），Render 会自动把连接串注入到后端的 `DATABASE_URL`。

3) 配置后端必须环境变量（在 Render 后端服务的 Environment 中设置）：
- `ENVIRONMENT`：生产环境必须为 `production`（Render 已在 render.yaml 中默认设置）
- `JWT_SECRET_KEY`：必须设置为强随机字符串
- `ADMIN_DEFAULT_PASSWORD`：管理员默认密码（上线建议改成强密码）
- `CORS_ORIGINS`：允许访问的来源（建议设置为你的前端域名；生产环境不允许 `*`）

4) 配置 AI（可选）：
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY`

5) 部署后验证：
- 后端健康检查：`/api/system/health`
- 后端接口文档：`/docs`
- 前端能正常打开，且能连上实时推送

---

## 📁 目录结构摘要
* `backend/app/services/game/`
  * `analysis.py` (分析分发与降级拦截中心)
  * `rule_engine.py` (强规则量化算法核心)
  * `betting.py` (强制自动下注与破产拦截)
  * `reveal.py` (开奖结算与连错错题本隔离逻辑)
* `frontend/src/pages/`
  * `DashboardPage.tsx` (全自动托管主界面)
  * `AdminPage.tsx` (双脑切换与资金调账控制台)

---

## Postgres 备份与恢复（生产运维）

说明：以下脚本需要环境中具备 `pg_dump`/`pg_restore`。如果你使用 docker compose 启动了 Postgres，也可以在 Postgres 容器内执行这些命令。

### 备份

方式一：直接使用连接串（推荐）

```bash
DATABASE_URL="postgresql://用户名:密码@主机:5432/库名" \
bash backend/scripts/pg_backup.sh
```

方式二：使用分字段环境变量

```bash
PGHOST=localhost PGPORT=5432 PGUSER=baccarat PGPASSWORD=baccarat PGDATABASE=baccarat \
bash backend/scripts/pg_backup.sh
```

默认输出到 `./backups/pg_YYYYMMDD_HHMMSS.dump`。

### 恢复

```bash
DATABASE_URL="postgresql://用户名:密码@主机:5432/库名" \
bash backend/scripts/pg_restore.sh ./backups/pg_20260101_120000.dump
```

---

## 数据库迁移（Alembic）

项目已内置 Alembic，用于在生产环境中安全演进表结构（避免仅依赖“启动自动建表/自动加字段”带来的不可控风险）。

### 初始化/升级

进入后端目录执行：

```bash
cd backend
alembic upgrade head
```

### 已有数据库如何接入

如果你已经运行过旧版本并且数据库里已有表结构，建议先运行一次：

```bash
cd backend
alembic stamp head
```

随后再用 `alembic upgrade head` 进行后续升级。

---

## 后台任务规范

- 业务后台任务（需要任务列表可见、可追溯、日志自动关联 task_id）：使用 [start_background_task](file:///workspace/backend/app/services/game/session.py) 创建。
- 非业务 fire-and-forget（例如 WebSocket 客户端清理）：使用 [spawn_task](file:///workspace/backend/app/core/async_utils.py) 创建。
