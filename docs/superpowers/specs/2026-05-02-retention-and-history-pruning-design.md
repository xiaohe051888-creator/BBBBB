# 自动清理（日志保留 + 历史数据裁剪）设计

日期：2026-05-02  
背景：系统已存在保留期配置（P3 7天、P2 30天、P1 永久）与 `retention_tier` 字段，但目前没有真正执行清理；`MAX_HISTORY_RECORDS` 也未被使用，长期运行会导致 SQLite/外部数据库体积持续增长。

## 目标

1. **系统日志自动清理**
   - P3 日志保留 `LOG_RETENTION_HOT` 天（默认 7 天）
   - P2 日志保留 `LOG_RETENTION_WARM` 天（默认 30 天）
   - P1 日志永久保留
   - `is_pinned=true` 的日志永不删除
2. **历史数据自动裁剪**
   - `GameRecord`、`BetRecord` 总量限制为 `MAX_HISTORY_RECORDS`（默认 1000），超过则删除最旧部分
3. **低侵入**
   - 不新增独立常驻 worker，复用现有 Watchdog 作为触发器（每小时最多执行一次）
   - 清理失败不影响主流程（捕获异常，仅写入一条 P1 日志提示）

## 非目标

- 不做外部告警通道（Slack/钉钉/邮件）
- 不引入复杂的归档（冷存储、导出）
- 不改变现有 API 的鉴权策略

## 方案概述

### 触发机制

- 在 `Watchdog.check_once` 中加入“retention 逻辑”，并通过 `_last_retention_ts` 做节流：
  - `now_ts - _last_retention_ts >= RETENTION_INTERVAL_SECONDS` 才会执行（默认 3600s）

### 日志写入：分层标记

- 修改 `write_game_log`：根据 `priority/is_pinned` 设置 `retention_tier`
  - P1 或 pinned -> `cold_perm`
  - P2 -> `warm30`
  - 其他 -> `hot7`
- 注意：清理逻辑不依赖 `retention_tier`，而是以 `priority/is_pinned/log_time` 为准，保证历史数据兼容性。

### 清理策略

#### A. SystemLog 清理

- 删除条件（均需 `is_pinned = false`）：
  - P3：`log_time < now - hot_days`
  - P2：`log_time < now - warm_days`
  - P1：不删

#### B. GameRecord / BetRecord 裁剪

- 以“最新 N 条”为保留集：
  - `GameRecord`：按 `(boot_number desc, game_number desc)` 取前 N，删除其余
  - `BetRecord`：按 `created_at desc` 取前 N，删除其余

### 可配置项

- `RETENTION_ENABLED`（默认 true）
- `RETENTION_INTERVAL_SECONDS`（默认 3600）
- 复用现有配置：
  - `LOG_RETENTION_HOT`
  - `LOG_RETENTION_WARM`
  - `MAX_HISTORY_RECORDS`

## 验收标准

- 系统运行时，不需要人工干预即可自动清理
- `SystemLog` 中超期 P2/P3 被删除，P1 与 pinned 不受影响
- `GameRecord`/`BetRecord` 总数不会超过 `MAX_HISTORY_RECORDS`（允许短时间内超过，下一次清理会收敛）
- 全量单测通过

