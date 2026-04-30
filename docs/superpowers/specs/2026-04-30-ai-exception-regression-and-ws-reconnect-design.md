# 稳 + 快（续）：AI 异常回归 + WebSocket 重连恢复 设计稿

日期：2026-04-30

## 目标

1. AI 异常路径可回归：在 AI 模式下发生异常/不可用时，系统不死锁、不卡在“分析中”，并能稳定降级。
2. WebSocket 重连更可靠：心跳协议一致（ping/pong），断线重连后自动拉齐关键数据（状态/日志/下注/游戏/分析）。

## 范围

### A) AI 异常回归（后端 + 测试）

1. 覆盖“API Key 已配置但 AI 调用抛异常”的路径：
   - mock `ThreeModelService.analyze` 抛异常
   - 断言 `run_ai_analysis(...)` 能返回 `success=True`（降级结果）且最终状态不为“分析中”
2. 覆盖“AI 模式但未配置 key 自动降级 rule”路径：
   - 设置 `prediction_mode="ai"` 且 keys 为空
   - 断言自动切换 `prediction_mode="rule"` 且返回结果可下注（庄/闲）

### B) WebSocket 重连恢复（前后端）

1. 心跳协议兼容：
   - 客户端发送文本 `"ping"`（与后端最小协议一致）
   - 后端同时兼容 JSON `{"type":"ping"}`（容错）
2. 重连后自动对齐：
   - WebSocket 重新 `open` 后，前端触发一次静默刷新（invalidateQueries）以补齐可能漏掉的推送。

## 验收

1. 新增 AI 异常回归测试通过，后端全量 unittest 通过。
2. WebSocket 心跳能正常 ping/pong（前后端一致）。
3. WebSocket 重连后，Dashboard 会自动触发一次数据刷新（状态/日志/下注/游戏/分析/路图）。

