# 第六轮：0-100 全面深度检查报告（2026-05-02）

## 结论

- 本轮定位并修复了“接口契约漂移 / 并发边界 / 资源泄漏 / 前后端消息结构不一致 / 列表 key 冲突”等深层问题；这些问题不一定立刻在 UI 上炸，但会在长期运行、断线重连、数据量变大或协议演进时集中暴露
- 回归验证：后端 `unittest` 通过（71 tests）；前端 `eslint + tsc -b + vite build` 通过；运行态冒烟无控制台 error/warn（仅保留 vite 连接日志）

## 已修复问题（按影响排序）

### FIX-001（P0）Dashboard WebSocket 协议字段名漂移，导致“开奖事件”乐观写入逻辑失效

- 根因：后端 `game_revealed` 推送字段为 `settlement`/`balance`，前端仍使用旧字段 `settlement_info`
- 影响：看似页面正常（因为轮询会刷新），但在高频推送/断网恢复时会出现“瞬时缺局/闪烁/乐观更新失效”，属于典型深层一致性问题
- 修复：[DashboardPage.tsx](file:///workspace/frontend/src/pages/DashboardPage.tsx)

### FIX-002（P0）WebSocket 重连/心跳定时器清理不完整，断线期可能残留 interval 与重复重连竞态

- 根因：
  - 断线/报错时未清理 ping interval
  - 重连成功后未清理已排队的 reconnect timer
  - 重连前未清理旧 ws 的 handler/连接（极端情况下会出现重复订阅/重复心跳）
- 修复：
  - [useWebSocket.ts](file:///workspace/frontend/src/hooks/useWebSocket.ts)
  - [useSystemDiagnostics.ts](file:///workspace/frontend/src/hooks/useSystemDiagnostics.ts)

### FIX-003（P1）后端 `/api/bets` 参数声明与实现不一致（status/sort 形同虚设）

- 根因：`status/sort_by/sort_order` 声明但未参与过滤/排序
- 修复：
  - 落地 `status` 过滤
  - 支持 `bet_time/game_number/bet_amount/profit_loss` 排序，并用 `id` 作为稳定次级排序
- 代码：[bet.py](file:///workspace/backend/app/api/routes/bet.py)
- 覆盖测试：[test_bet_records_api.py](file:///workspace/backend/tests/test_bet_records_api.py)

### FIX-004（P1）后端上传触发分析的异常分支写日志未 commit，导致关键错误证据可能丢失

- 修复：写入 `SystemLog` 后补 `commit()`，保证落库
- 代码：[game.py](file:///workspace/backend/app/api/routes/game.py)

### FIX-005（P1）WebSocket 广播串行发送会被慢客户端拖垮，并且 ws_count 读取存在竞态

- 修复：
  - 广播改为并发发送（`gather + wait_for`），失败连接异步清理
  - 提供 `get_ws_client_count()` 带锁读取，系统诊断不再直接触碰共享容器
- 代码：
  - [websocket.py](file:///workspace/backend/app/api/routes/websocket.py)
  - [system.py](file:///workspace/backend/app/api/routes/system.py)

### FIX-006（P2）前端类型契约不一致与列表 key 风险

- `getHealthScore()` 返回类型与实现不一致（签名 Promise<Data>，实际返回 AxiosResponse）：已改为返回 `.data`  
  - [api.ts](file:///workspace/frontend/src/services/api.ts)
- BetRecordsPage rowKey 可能碰撞：已改为使用后端唯一主键 `id`  
  - [BetRecordsPage.tsx](file:///workspace/frontend/src/pages/BetRecordsPage.tsx)
- SmartAlerts 使用 index 作为 key：已改为内容/时间戳稳定 key  
  - [SmartAlerts.tsx](file:///workspace/frontend/src/components/ui/SmartAlerts.tsx)

### FIX-007（P2）后台任务持久化失败被静默吞掉，导致任务面板与实际状态可能漂移

- 修复：保留原降级逻辑，但持久化失败会写 exception 日志，便于排障
- 代码：[task_registry.py](file:///workspace/backend/app/services/game/task_registry.py)

## 冒烟证据

- Dashboard（修复后）：`./screenshots/01-dashboard-after-frontend-fixes.png`
- Dashboard（基础冒烟）：`./screenshots/00-dashboard.png`

