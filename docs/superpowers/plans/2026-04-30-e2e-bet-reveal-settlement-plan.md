# 下注→开奖→结算 端到端回归测试 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增稳定、可重复的 E2E 回归用例覆盖下注→开奖→结算关键链路（赢/输/和局/余额不足）。

**Architecture:** 在单测中直接调用 `place_bet` 与 `reveal_game`，并显式初始化内存 Session 与 DB SystemState，确保状态机满足前置条件。

**Tech Stack:** Python unittest + asyncio.run；SQLAlchemy AsyncSession；现有业务服务层函数。

---

## Task 1：新增 E2E 回归测试文件

**Files:**
- Create: `/workspace/backend/tests/test_e2e_bet_reveal_settlement.py`

- [ ] **Step 1: 写测试辅助函数**

在测试文件内写：
- `_new_boot_number()`：生成一个较大且随机的 boot_number（避免与其他用例冲突）
- `_prepare_state(boot_number, balance, status, next_game_number)`：同时更新内存 Session 与 DB SystemState

- [ ] **Step 2: 覆盖 赢/输/和局**

每条用例：
- init_db
- prepare_state(status="等待下注", next_game_number=1)
- 调用 `place_bet(..., game_number=1, direction="庄", amount=100)`
- 调用 `reveal_game(..., game_number=1, result="庄"/"闲"/"和")`
- 断言：
  - BetRecord 由 “待开奖” 更新到 “已结算/和局退回”
  - profit_loss/settlement_amount 与 result 逻辑一致
  - balance_after 与 session.balance 一致

- [ ] **Step 3: 覆盖 余额不足**

- prepare_state(balance=50, status="等待下注")
- 调用 `place_bet(amount=100)` 返回 success=False
- 断言：
  - 内存 Session 与 DB SystemState status == "余额不足"
  - 不会生成 status="待开奖" 的 BetRecord

---

## Task 2：全量验证

- [ ] **Step 1: 后端全量单测**

Run:

```bash
python -m unittest discover -s backend/tests -p 'test_*.py' -v
```

Expected: PASS

