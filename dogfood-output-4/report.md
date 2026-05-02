# 第五轮：0-100 全面深度检查报告（2026-05-02）

## 结论（本轮新增）

- 已发现并修复：2 个 P1、3 个 P2（数据保留裁剪覆盖、日志保留语义一致性、前端列表 key 冲突导致控制台报错、启动入口与门禁函数重复）
- 全量回归：后端 `unittest` 通过；前端 `eslint + tsc + vite build` 通过；运行态冒烟无控制台 error/warn 与关键接口失败

## 已修复问题

### FIX-001（P1）History 裁剪只覆盖 Game/Bet，长期会产生 RoadMap/MistakeBook/AIMemory 孤儿数据与膨胀

- 修复：`prune_history()` 以 `GameRecord` 的“保留边界 (boot_number, game_number)”为全局 cutoff，同步裁剪：
  - `RoadMap`
  - `MistakeBook`
  - `AIMemory`
  - `BetRecord`
  - `GameRecord`
- 代码：
  - [retention.py](file:///workspace/backend/app/services/game/retention.py)
  - 覆盖单测：[test_history_pruning.py](file:///workspace/backend/tests/test_history_pruning.py)

### FIX-002（P1）`retention_tier` 写入语义与清理策略不一致，且 AI 学习模块对 P3 错误设置为 warm30

- 修复：
  - `cleanup_logs()` 改为以 `retention_tier` 为准执行清理（hot7/warm30），避免“字段存在但不生效”的语义漂移
  - `ai_learning_service` 写日志时的 tier 映射与 `write_game_log()` 对齐：P1=cold_perm、P2=warm30、P3=hot7
- 代码：
  - [retention.py](file:///workspace/backend/app/services/game/retention.py)
  - [ai_learning_service.py](file:///workspace/backend/app/services/ai_learning_service.py)
  - 覆盖单测：[test_retention_cleanup.py](file:///workspace/backend/tests/test_retention_cleanup.py)

### FIX-003（P2）前端 BetTable 出现 React key 冲突（控制台大量 Warning）

- 现象：控制台持续提示同 key（如 `bet-1-1000`）导致 React 列表 diff 行为不可预期
- 修复：
  - 后端 `/api/bets` 响应补充 `id`、`bet_seq`，保证 UI 可使用稳定唯一 key
  - 前端 BetTable 使用 `id` 作为 `rowKey`
  - WebSocket 的“乐观下注记录”补充临时负数 `id`，保证类型与渲染一致
- 代码：
  - [bet.py](file:///workspace/backend/app/api/routes/bet.py)
  - [BetTable.tsx](file:///workspace/frontend/src/components/tables/BetTable.tsx)
  - [models.ts](file:///workspace/frontend/src/types/models.ts)
  - [DashboardPage.tsx](file:///workspace/frontend/src/pages/DashboardPage.tsx)
- 证据（冒烟截图）：
  - `./screenshots/03-dashboard-after-fix.png`

### FIX-004（P2）启动入口与门禁函数重复（旧逻辑可能影响新逻辑）

- 修复：
  - `backend/main.py` 去除重复 dotenv 加载与 settings 预读取，改为纯粹启动 `app.api.main:app`，避免加载顺序分裂
  - 提取统一门禁 `is_secret_configured()`，替换 `system.py` 内三处 `_enabled()` 与 `api/main.py` 内重复实现
- 代码：
  - [main.py](file:///workspace/backend/main.py)
  - [utils.py](file:///workspace/backend/app/api/routes/utils.py)
  - [system.py](file:///workspace/backend/app/api/routes/system.py)
  - [api/main.py](file:///workspace/backend/app/api/main.py)

## 冒烟证据（截图）

- Dashboard：`./screenshots/00-dashboard.png`
- Admin：`./screenshots/01-admin.png`
- Admin/数据库存储：`./screenshots/02-admin-db.png`
- Dashboard（修复后）：`./screenshots/03-dashboard-after-fix.png`

## 仍建议优化（未强行改动）

- Retention 的“日志/历史”目前按数量/天数裁剪，若未来引入更多依赖表，建议以 `(boot_number, game_number)` 为中心统一数据生命周期，避免再次出现孤儿表
