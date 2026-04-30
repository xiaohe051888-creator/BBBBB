# 全自动托管闭环：指数下注金额 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Task 1：先写测试（RED）

- [ ] 新增 `backend/tests/test_bet_sizing_exponential.py`
  - conf < 0.6 → amount == MIN_BET
  - conf = 1.0 → amount == MAX_BET（考虑 BET_STEP 取整）
  - 单调递增：conf=0.7 < 0.9 的 amount

- [ ] 新增/更新 `backend/tests/test_e2e_upload_analysis_bet_reveal.py`
  - 断言 `analysis.bet_amount` 与指数策略一致（而不是固定 100）

## Task 2：实现指数下注金额（GREEN）

- [ ] 新增 `backend/app/services/game/bet_sizing.py`
  - `compute_bet_amount(conf: float, balance: float) -> float`

- [ ] `backend/app/core/config.py` 增加参数
  - BET_CONF_THRESHOLD=0.60
  - BET_EXP_GAMMA=2.0

- [ ] 修改 `backend/app/services/game/analysis.py`
  - 分析完成后统一用 `compute_bet_amount(confidence, sess.balance)` 计算并写入：
    - `sess.predict_bet_amount`
    - `state.current_bet_tier`（保持）
    - broadcast/return 的 `bet_amount`

## Task 3：全量验证（GREEN）

- [ ] `python -m unittest discover -s backend/tests -p 'test_*.py' -v`

