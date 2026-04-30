# 运行稳定闭环：Watchdog 自愈 + 外部监控脚本 + 浸泡压测 设计稿

日期：2026-04-30

## 目标

把运行不确定性收敛为可检测、可告警、可自愈、可回归的闭环：

1. 服务端内置 Watchdog：定期巡检系统健康信号，在满足条件时自动触发修复，并写入 SystemLog，减少人工介入。
2. 外部监控脚本：作为兜底手段，可在服务端禁用 watchdog 时由 cron/systemd 执行。
3. 浸泡/压测脚本：提供可重复的并发场景脚本，输出成功率、延迟分布与错误摘要，作为运行稳定基线。

## 约束

- 不新增第三方监控系统依赖（不引入 Prometheus/Sentry/OTel）。
- 不改变核心业务流程语义，只增加可观测与自愈能力。
- 默认阈值选择“保守”，避免误修复与频繁扰动。

## Watchdog 设计（服务端）

### 触发频率（保守默认）

- 每 60 秒巡检一次。
- 修复有冷却窗口：5 分钟内最多触发一次修复。

### 检测信号

1. 卡住信号（stuck）
   - `SystemState.status` 为“分析中/深度学习中”
   - 但 `background_tasks` 表中不存在对应 `task_type` 的 `running` 任务
2. 任务积压信号（backlog）
   - `running_count > 20`
3. P1 错误信号（p1_errors）
   - 最近 10 分钟出现 P1 级 SystemLog（priority="P1"）数量 > 0

### 行为

- stuck：自动调用修复逻辑（复用 `repair_stuck_state`），并写 SystemLog：
  - event_code: `LOG-WDG-001`
  - event_type: `Watchdog`
  - event_result: `AutoRepair`
- backlog / p1_errors：只写 SystemLog 告警，不自动取消任务（避免误杀）：
  - event_code: `LOG-WDG-002` / `LOG-WDG-003`
  - event_result: `Alert`

### 配置开关

通过环境变量/Settings 控制：
- WATCHDOG_ENABLED（默认 true）
- WATCHDOG_INTERVAL_SECONDS（默认 60）
- WATCHDOG_REPAIR_COOLDOWN_SECONDS（默认 300）
- WATCHDOG_RUNNING_TASK_THRESHOLD（默认 20）
- WATCHDOG_P1_ERROR_WINDOW_SECONDS（默认 600）
- WATCHDOG_P1_ERROR_THRESHOLD（默认 1）

## 外部监控脚本

提供 `scripts/monitor.py`：

- 轮询 `/api/system/diagnostics`
- 若发现 stuck_signals 且提供管理员密码，则调用 `/api/admin/login` 获取 token，再 POST `/api/system/repair`
- 输出简洁日志到 stdout，便于 systemd/cron 收集

## 浸泡/压测脚本

提供 `scripts/soak_test.py`：

- 用 httpx 并发跑若干轮组合场景（上传/下注/开奖/诊断）
- 输出：成功率、平均/95分位延迟、错误摘要、repair 触发次数

## 验收

1. Watchdog 在单测中可验证：检测到 stuck 会触发修复并写入日志，且冷却窗口生效。
2. 后端全量 unittest 通过。
3. scripts 可直接运行（不要求 CI 执行）。

