# 第四轮：0-100 全面深度检查报告（2026-05-02）

## 范围

- 后端：FastAPI 路由、鉴权、WebSocket、maintenance/retention、watchdog、自愈链路、测试覆盖
- 前端：Dashboard/Admin/Logs/ModeSelect 关键路径、API 封装、eslint/tsc/vite build、运行时冒烟
- 目标：找出问题、逻辑不通、可优化点、重复与冲突、旧逻辑对新功能的影响；并对高风险项直接修复并回归验证

## 结论（汇总）

- 已发现并修复：2 个 P0（后端重复/冲突实现导致“状态暴露不一致”与“鉴权规则分裂”）、1 个 P2（前端维护统计加载态在 dev 严格模式/异常情况下可能卡住）
- 仍建议后续优化：3 个 P1/P2（保留期覆盖范围、保留策略字段语义一致性、dotenv 入口统一），见“建议改进清单”

## 已执行验证

- 后端单测：`python -m unittest discover -s backend/tests`（70 tests，OK）
- 前端：`npm run lint`（OK）、`npm run build`（OK）
- 端到端冒烟：启动 `uvicorn`（8001）+ `vite dev`（5173），覆盖 Dashboard/Admin/Logs/Maintenance 基本交互，无控制台红错与关键接口失败

## 已修复问题

### FIX-001（P0）WebSocket 客户端列表“双份实现”，状态暴露不一致

- 表现：`app.state.ws_clients` 暴露的是 `api/main.py` 的空列表；而实际 ws 广播使用的是 `routes/websocket.py` 的列表，导致外部读取到的连接数/状态可能错误
- 修复：移除 `api/main.py` 内重复的 `ws_clients`，统一暴露为 `routes/websocket.py` 的同一份列表
- 代码：
  - [main.py](file:///workspace/backend/app/api/main.py)
  - [websocket.py](file:///workspace/backend/app/api/routes/websocket.py)

### FIX-002（P0）JWT 校验逻辑重复，WS/HTTP 未来易出现“规则不一致”

- 表现：HTTP 使用 `get_current_user()`；WS 单独写了 `jwt.decode()`，后续若加入额外 claim 校验/黑名单等，会出现“只对 HTTP 生效、WS 漏校验”的风险
- 修复：在认证工具中抽出 `decode_token()`，HTTP/WS 复用同一套 decode+sub 校验语义
- 代码：
  - [utils.py](file:///workspace/backend/app/api/routes/utils.py)
  - [websocket.py](file:///workspace/backend/app/api/routes/websocket.py)

### FIX-003（P2）管理页“维护与清理 / 刷新统计”加载态可能卡住

- 复现观察：进入“管理员 → 数据库存储”后，按钮 aria name 长时间保持 `loading 刷新统计`，即使 `/api/admin/maintenance/stats` 已 200 返回（见截图）
- 修复：为 `loadMaintenanceStats()` 增加 10s 兜底超时释放 loading，避免极端情况下 UI 永久卡住（并保留原 `finally` 正常收敛路径）
- 证据：
  - 修复前截图：`./screenshots/02-admin-db-maintenance.png`
  - 修复后截图：`./screenshots/03-admin-db-maintenance-fixed.png`
- 代码：
  - [AdminPage.tsx](file:///workspace/frontend/src/pages/AdminPage.tsx)

## 冒烟证据（截图）

- Dashboard：首页 `./screenshots/00-dashboard.png`
- Admin：管理页入口 `./screenshots/01-admin.png`
- Admin/DB：维护与清理区 `./screenshots/03-admin-db-maintenance-fixed.png`

## 建议改进清单（未强行改动，避免改变产品语义）

### SUG-001（P1）Retention/History Pruning 覆盖表范围不完整（长期数据膨胀风险）

- 现状：当前清理主要覆盖 `SystemLog/GameRecord/BetRecord`，但仍有 `RoadMap/MistakeBook/AI*` 等增长表未纳入统一策略
- 建议：以“保留最近 N 局 / 最近 N 靴”的 cutoff 为基准，清理所有依赖表，避免孤儿数据与统计口径漂移
- 相关代码：
  - [retention.py](file:///workspace/backend/app/services/game/retention.py)
  - [schemas.py](file:///workspace/backend/app/models/schemas.py)

### SUG-002（P1）`retention_tier` 字段写入但不参与清理决策（语义误导）

- 建议：二选一：清理策略改为以 `retention_tier` 为准；或停止写入并在 schema/文档中移除该字段
- 相关代码：
  - [logging.py](file:///workspace/backend/app/services/game/logging.py)
  - [retention.py](file:///workspace/backend/app/services/game/retention.py)

### SUG-003（P2）dotenv 加载入口双轨（启动方式不同可能导致覆盖顺序差异）

- 现状：`backend/main.py` 与 `app/api/main.py` 都在加载 `.env`，后者还包含迁移/合并逻辑
- 建议：保留单一权威入口（建议 `app/api/main.py`），减少“旧入口影响新行为”的概率
- 相关代码：
  - [backend/main.py](file:///workspace/backend/main.py)
  - [api/main.py](file:///workspace/backend/app/api/main.py)

