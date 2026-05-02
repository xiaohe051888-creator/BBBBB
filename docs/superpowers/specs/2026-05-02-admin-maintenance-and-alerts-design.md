# 管理页维护面板 + 管理员告警条 设计

日期：2026-05-02  
范围：仅管理员可见  
目标：提升长期运行的可观测性与可维护性（数据体积、清理执行、P1 事件可见）

## 目标

1. 管理页“数据库存储”新增维护区：
   - 数据统计：数据库大小、日志条数（按优先级/置顶）、开奖记录条数、下注记录条数
   - 清理配置展示：P3/P2 保留天数、历史条数上限、自动清理开关/间隔
   - 一键手动清理：触发一次 retention（日志清理 + 历史裁剪），返回删了多少
2. Dashboard 新增“管理员告警条/待处理列表”：
   - 展示最近一段时间的 P1 日志（默认 24h）
   - 支持折叠/展开，点击跳转到“实盘日志”页并自动筛选 P1
3. 后端新增 admin-only 维护接口（只读 + 手动触发）并补齐单测

## 约束与非目标

- 非目标：外部通知（钉钉/邮件/短信），不做复杂 Ack/工单流转
- 约束：不泄露内部异常给未登录用户；所有接口均需 admin token

## 方案概述

### 后端 API

新增 `app/api/routes/maintenance.py`，挂载前缀 `/api/admin/maintenance`：

1. `GET /stats`
   - 返回：数据库大小（仅 sqlite 时）、SystemLog 总数与按 priority 的数量、pinned 数量、GameRecord 数量、BetRecord 数量
   - 同时返回清理配置（RETENTION_* / LOG_RETENTION_* / MAX_HISTORY_RECORDS）
2. `POST /retention/run`
   - 立即执行一次：`cleanup_logs + prune_history`
   - 返回：本次删除数量与耗时
   - 写一条 P2 日志：`LOG-MAINT-RET`（可追溯）
3. `GET /alerts`
   - 参数：`hours`（默认 24）、`limit`（默认 20）
   - 返回：最近 P1 日志列表 + count

### 前端

1. AdminPage（数据库存储 Tab）：
   - 展示 stats 卡片 + 刷新按钮
   - 展示“立即清理”按钮（触发 POST /retention/run），弹 toast 显示删除量
2. DashboardPage：
   - 管理员登录时，轮询 `GET /alerts`（例如 10s）
   - 有 P1 事件时，在顶部显示红色告警条（可展开列表）
   - “查看全部”跳转 `/logs?priority=P1`

## 验收标准

- 仅管理员可见（无 token 调用返回 401）
- 管理页可看到统计数据且可手动触发清理
- Dashboard 在产生 P1 日志后能看到告警条并可跳转到日志页
- 后端全量单测通过，新增接口有基本覆盖

