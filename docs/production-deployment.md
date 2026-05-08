# 生产部署清单

这份清单对应当前仓库的真实上线要求，按它执行可以避免把开发环境习惯带到生产环境。

## 必要环境变量（后端）

- `ENVIRONMENT=production`
- `DATABASE_URL=postgresql+asyncpg://...`
- `JWT_SECRET_KEY=<强随机字符串>`
- `AI_CONFIG_ENCRYPTION_KEY=<独立强随机字符串>`
- `ADMIN_DEFAULT_PASSWORD=<强密码>`
- `CORS_ORIGINS=https://你的前端域名`

如果要启用 AI：

- 三模型模式：`OPENAI_API_KEY`、`ANTHROPIC_API_KEY`、`GEMINI_API_KEY`
- 单 AI 模式：`SINGLE_AI_API_KEY`、`SINGLE_AI_MODEL`、`SINGLE_AI_API_BASE`

## 上线前检查

1. 生产使用 Postgres，不要用 SQLite。
2. 不要把 `.env`、`backend/.env`、任何真实密钥提交到仓库。
3. `CORS_ORIGINS` 不能包含 `localhost`、`127.0.0.1`、`*`。
4. `AI_CONFIG_ENCRYPTION_KEY` 必须和 `JWT_SECRET_KEY` 分开设置。

## 部署后验证

- `GET /api/system/ping` 返回正常
- 管理员可以登录
- 前端能打开并能连接 WebSocket

## 当前生产默认行为

- 生产环境默认关闭 `/docs`、`/redoc`、`/openapi.json`
- 外部环境变量优先于本地 `.env`
- 已保存的 AI 配置会从数据库恢复
