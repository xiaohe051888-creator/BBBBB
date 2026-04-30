# AI 异常回归 + WebSocket 重连恢复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 AI 异常/降级路径与 WebSocket 重连数据补齐做成可回归、可验证的机制。

**Architecture:** 后端用 mock 与 settings 注入覆盖 AI 异常与无 key 降级；WebSocket 后端兼容 ping 协议；前端在 WS 重连成功时触发一次 query invalidate 补齐漏消息。

**Tech Stack:** unittest + unittest.mock；FastAPI WebSocket；React Query。

---

## Task 1：AI 异常回归测试

**Files:**
- Create: `/workspace/backend/tests/test_ai_analysis_fallbacks.py`

- [ ] **Step 1: 测试 AI 调用异常时不死锁**

mock：
- `app.services.three_model_service.ThreeModelService.analyze` 抛异常
- 临时设置 settings 的 key 为非空字符串（满足“认为已配置”的分支）

断言：
- `run_ai_analysis(...).success == True`
- 内存 session / DB state 最终不处于 `"分析中"`

- [ ] **Step 2: 测试无 key 自动降级 rule**

断言：
- `prediction_mode` 从 ai 变为 rule
- 返回 `prediction in ("庄","闲")`

---

## Task 2：WebSocket 心跳兼容（后端）

**Files:**
- Modify: `/workspace/backend/app/api/routes/websocket.py`

- [ ] **Step 1: 兼容 JSON ping**

收到文本时：
- 若为 `"ping"` → 回复 `{"type":"pong"}`
- 否则尝试 JSON parse，若 `{"type":"ping"}` → 回复 `{"type":"pong"}`

---

## Task 3：WebSocket 重连补齐（前端）

**Files:**
- Modify: `/workspace/frontend/src/hooks/useWebSocket.ts`
- Modify: `/workspace/frontend/src/pages/DashboardPage.tsx`
- Modify: `/workspace/frontend/src/hooks/useSystemDiagnostics.ts`

- [ ] **Step 1: 前端统一发送文本 ping**

将 `ws.send(JSON.stringify({ type: 'ping' }))` 改为 `ws.send('ping')`。

- [ ] **Step 2: useWebSocket 增加 onReconnect 回调**

当 ws.onopen 触发且属于重连（reconnectCountRef>0）时：
- 调用 `options.onReconnect?.()`

- [ ] **Step 3: Dashboard 重连后 invalidateQueries 补齐**

在 Dashboard 的 useWebSocket 里传 `onReconnect`：
- invalidate `['systemState'] ['analysis'] ['roads'] ['logs'] ['bets'] ['games']`

- [ ] **Step 4: useSystemDiagnostics 心跳也改为文本 ping**

---

## Task 4：全量验证

- [ ] **Step 1: 后端全量 unittest**

Run:

```bash
python -m unittest discover -s backend/tests -p 'test_*.py' -v
```

- [ ] **Step 2: 前端 lint/build**

Run:

```bash
npm run lint
npm run build
```

