# 稳：下注→开奖→结算 端到端回归测试 设计稿

日期：2026-04-30

## 目标

用可重复、确定性的端到端（E2E）回归测试锁定“下注→开奖→结算”关键链路，覆盖：
- 赢（下注方向=开奖结果）
- 输（下注方向≠开奖结果）
- 和局（退回本金）
- 余额不足（下注被拒绝，状态进入“余额不足”）

## 测试边界

- 不引入新的测试依赖，沿用现有 `unittest + asyncio.run` 模式。
- 不通过 HTTP 调用（项目目前没有公开“手动下注”API），直接调用服务层函数以保证确定性与执行速度：
  - `app.services.game.betting.place_bet`
  - `app.services.game.reveal.reveal_game`
- 每条测试用例使用独立的 `boot_number`，避免与其他用例共享状态导致偶发冲突。
- 测试前同步设置：
  - 内存 Session（`get_session()`）的 `boot_number / balance / next_game_number / status`
  - DB SystemState（`get_or_create_state`）的 `boot_number / balance / status`

## 验收

1. 赢/输/和局：能正确写入 BetRecord，并在开奖后把 BetRecord 从“待开奖”更新为“已结算/和局退回”，同时余额变更符合预期。
2. 余额不足：下注返回失败，系统状态与 DB 状态进入“余额不足”，且不会生成 BetRecord。

