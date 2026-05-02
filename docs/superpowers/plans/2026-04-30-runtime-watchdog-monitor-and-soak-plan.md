# 运行稳定闭环：Watchdog + 监控脚本 + 浸泡压测 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 增加服务端 Watchdog 自动巡检与自愈、提供外部 monitor/soak 脚本，并补回归测试，强化运行稳定闭环。

**Architecture:** Watchdog 以后台任务运行，内部调用一次性 check 函数（便于单测）；检测 stuck/backlog/p1_errors 并写 SystemLog，stuck 时触发 repair；脚本通过 HTTP 轮询 diagnostics 并可选触发 repair。

**Tech Stack:** FastAPI lifespan + spawn_task；SQLAlchemy AsyncSession；unittest；httpx（已在依赖中）。

---

## Task 1：Settings 增加 watchdog 配置

**Files:**
- Modify: `/workspace/backend/app/core/config.py`

- [ ] **Step 1: 增加 Settings 字段**

新增：
- WATCHDOG_ENABLED
- WATCHDOG_INTERVAL_SECONDS
- WATCHDOG_REPAIR_COOLDOWN_SECONDS
- WATCHDOG_RUNNING_TASK_THRESHOLD
- WATCHDOG_P1_ERROR_WINDOW_SECONDS
- WATCHDOG_P1_ERROR_THRESHOLD

---

## Task 2：实现 Watchdog（可单测）

**Files:**
- Create: `/workspace/backend/app/services/game/watchdog.py`
- Modify: `/workspace/backend/app/api/main.py`

- [ ] **Step 1: 实现 Watchdog 类**

提供：
- `async def check_once()`：执行一次巡检（便于单测）
- `async def run_forever()`：循环 sleep + check_once

check_once 内部：
- 读 `detect_stuck_state`
- 统计 `BackgroundTask.running` 数量与分布
- 统计最近 P1 SystemLog 数量
- 符合条件则调用 `repair_stuck_state` 或写告警日志

- [ ] **Step 2: 在 lifespan 启动 watchdog**

当 `settings.WATCHDOG_ENABLED` 为 true 时：
- `spawn_task(watchdog.run_forever(), name="watchdog")`

---

## Task 3：回归测试

**Files:**
- Create: `/workspace/backend/tests/test_watchdog_auto_repair.py`

- [ ] **Step 1: stuck 自动修复**

构造：
- SystemState.status="分析中"
- background_tasks 无 running analysis

执行 `check_once()`：
- 断言状态回落到“等待开奖”
- 断言写入 SystemLog(event_code="LOG-WDG-001")

- [ ] **Step 2: 冷却窗口生效**

连续执行两次 `check_once()`：
- 第二次不应重复写 `LOG-WDG-001`

---

## Task 4：外部监控脚本与浸泡脚本

**Files:**
- Create: `/workspace/scripts/monitor.py`
- Create: `/workspace/scripts/soak_test.py`

- [ ] **Step 1: monitor.py**

参数：
- BASE_URL（默认 http://localhost:8001）
- ADMIN_PASSWORD（可选，存在时允许触发 repair）

行为：
- GET diagnostics
- 若存在 stuck_signals 且有密码：login 获取 token → POST repair
- 输出 JSON 行到 stdout

- [ ] **Step 2: soak_test.py**

参数：
- BASE_URL
- CONCURRENCY / ROUNDS
- ADMIN_PASSWORD（可选）

行为：
- 并发跑 upload/analysis(rule)/bet/reveal/diagnostics 组合
- 输出成功率与延迟统计

---

## Task 5：全量验证

- [ ] **Step 1: 后端全量 unittest**

Run:

```bash
python -m unittest discover -s backend/tests -p 'test_*.py' -v
```
