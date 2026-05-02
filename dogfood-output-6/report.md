# 第七轮（0-100）深度检查报告

## 范围

- 前端 SPA（Dashboard / Upload / Logs / Admin / BetRecords / RoadMap / MistakeBook）
- 后端 API（system/health、system/diagnostics、upload/reveal/bets/logs、admin/maintenance 等）
- WebSocket（/ws：鉴权、心跳、重连、广播）
- 工程化一致性（环境变量命名、启动入口、旧逻辑影响新逻辑）

## 证据

- Dashboard 初始页截图：`screenshots/00-dashboard.png`
- Admin 页截图：`screenshots/01-admin.png`
- Upload 选局截图：`screenshots/02-upload-selected.png`

## 发现与修复

### ISSUE-001（P2）后端启动入口端口环境变量不一致（旧配置可能影响新部署）

- 现象
  - [backend/main.py](file:///workspace/backend/main.py) 启动入口读取 `PORT` 环境变量
  - [backend/app/core/config.py](file:///workspace/backend/app/core/config.py) 与 docker-compose / start-all 约定读取 `BACKEND_PORT`
  - 结果：直接运行 `python backend/main.py` 时，若只设置 `BACKEND_PORT`（不设置 `PORT`），会出现“进程监听端口与系统日志/配置认知不一致”的隐性问题
- 修复
  - `backend/main.py` 端口读取逻辑改为优先 `BACKEND_PORT`，再 fallback 到 `PORT`
- 验证
  - `python -m py_compile backend/main.py` 通过

### ISSUE-002（P1）WebSocket 使用 URL query 传 token 会被 access log 记录（敏感信息泄漏）

- 现象
  - 浏览器端通过 `ws://.../ws?token=...` 建连时，服务端 access log 会输出完整 URL（包含 token）
- 修复
  - 前端改为 WS 建连后首包发送 `{"type":"auth","token":"..."}`，不再把 token 放在 URL
  - 后端改为 accept 后等待首包 auth（2 秒超时），校验通过后才加入广播列表
  - 更新回归测试覆盖 “无 auth 关闭 / 有 auth + ping 收到 pong”
- 验证
  - 服务端日志显示 `WebSocket /ws`（不再包含 token）

## 冒烟回归（关键链路）

- 打开 Dashboard：OK（见 `screenshots/00-dashboard.png`）
- 进入 Admin：OK（见 `screenshots/01-admin.png`）
- Upload：选择第 1 局结果并覆盖上传：OK（见 `screenshots/02-upload-selected.png`，随后回到 Dashboard 显示新数据）
- Logs：可进入并正常渲染（无明显 console error）
