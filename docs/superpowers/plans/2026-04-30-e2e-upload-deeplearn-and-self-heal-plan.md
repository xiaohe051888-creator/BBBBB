# 上传/深度学习 E2E 回归 + 自愈检测与修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补齐上传与深度学习两条关键链路的 E2E 回归，并提供系统诊断/修复能力以提升稳定性。

**Architecture:** 用规则模式与 mock 学习确保测试确定性；新增 system repair endpoint 复用恢复逻辑并对“状态卡住”做兜底；诊断接口补输出。

**Tech Stack:** Python unittest + asyncio.run；FastAPI；SQLAlchemy AsyncSession；unittest.mock。

---

## Task 1：E2E（上传→分析→下注→开奖→下一局分析）

**Files:**
- Create: `/workspace/backend/tests/test_e2e_upload_analysis_bet_reveal.py`

- [ ] **Step 1: 写准备函数**

- 初始化 DB
- 设置内存 Session 与 DB SystemState：
  - `prediction_mode="rule"`
  - `status="等待下注"`
  - `boot_number` 使用随机值避免冲突

- [ ] **Step 2: 写用例**

流程：
1) 调用 `upload_games(...)` 写入至少 1 局历史数据（result 有效）
2) 调用 `run_ai_analysis(...)`（规则模式，不依赖 key）
3) 用返回 prediction 调用 `place_bet(...)`，断言生成 BetRecord(status="待开奖")
4) 调用 `reveal_game(...)` 开奖，断言 BetRecord 更新为“已结算/和局退回”
5) 再次调用 `run_ai_analysis(...)` 模拟“下一局分析触发”，并断言状态不死锁（最终不停留在分析中）

---

## Task 2：E2E（结束本靴→深度学习→等待新靴）

**Files:**
- Create: `/workspace/backend/tests/test_e2e_end_boot_deep_learning.py`

- [ ] **Step 1: 准备 5 局已开奖 GameRecord**

写入 boot_number 下 `GameRecord.result is not None` 至少 5 条，且无待开奖注单。

- [ ] **Step 2: end_boot 进入深度学习中**

设置 `prediction_mode="ai"` 并调用 `end_boot(...)`：
- 断言返回 success=True
- 断言 SystemState.status == "深度学习中"

- [ ] **Step 3: mock 学习并执行 run_deep_learning**

用 `unittest.mock.patch` 替换 `AILearningService.start_learning` 返回：
- `success=True`
- `version="v-test"`

调用 `run_deep_learning(boot_number)`：
- 断言 SystemState.status == "等待新靴"
- 断言写入 SystemLog(event_code="LOG-BOOT-002")

---

## Task 3：自愈 endpoint + 诊断增强

**Files:**
- Modify: `/workspace/backend/app/api/routes/system.py`
- Modify: `/workspace/backend/app/services/game/recovery.py`
- Test: `/workspace/backend/tests/test_system_repair_api.py`

- [ ] **Step 1: recovery.py 新增 detect/repair helper**

新增：
- `async def detect_stuck_state(db) -> dict`
- `async def repair_stuck_state(db) -> dict`

规则：
- 若状态=分析中/深度学习中，但 background_tasks 中无对应 running 的 task_type，则回落到安全态并写 SystemLog。

- [ ] **Step 2: 新增 /api/system/repair（鉴权）**

实现：
- 调用 `recover_on_startup(db)`（复用）
- 再调用 `repair_stuck_state(db)`（补漏）
- 返回修复结果摘要（修复了多少项）

- [ ] **Step 3: diagnostics 增强输出**

补充字段：
- running_tasks_by_type
- stuck_signals

- [ ] **Step 4: 单测**

在测试中手工制造：
- SystemState.status="分析中"
- background_tasks 无 running analysis

调用 repair handler（直接调用函数或通过 fastapi TestClient 如果项目已有模式），断言状态回落并写 SystemLog。

---

## Task 4：全量验证

- [ ] **Step 1: 后端全量 unittest**

Run:

```bash
python -m unittest discover -s backend/tests -p 'test_*.py' -v
```

Expected: PASS

