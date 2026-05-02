# Docker Compose 开发友好安全默认（Postgres + 端口/健康检查一致）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不牺牲开发体验的前提下，降低 docker-compose 默认配置的“误用风险”：默认 CORS 不再是 *，JWT_SECRET_KEY 不再使用占位值（改为自动生成/写入），同时保持生产环境严格校验不变。

**Architecture:**  
- docker-compose 仍默认启用 Postgres。  
- CORS 默认仅允许本机前端 `http://localhost:5173`（可通过环境变量覆盖）。  
- JWT_SECRET_KEY：不再在 compose 中提供占位默认值，由后端启动逻辑自动生成并写入 backend/.env（仅开发），生产环境仍要求显式设置。  
- healthcheck/端口继续保持 8001。  

**Tech Stack:** Docker Compose + FastAPI 启动自检 + .env 写入。

---

### Task 1: docker-compose 默认 CORS 改为本机前端

**Files:**
- Modify: [docker-compose.yml](file:///workspace/docker-compose.yml#L25-L73)

- [ ] 将 `CORS_ORIGINS` 默认从 `*` 改为 `http://localhost:5173`

---

### Task 2: docker-compose 移除 JWT_SECRET_KEY 占位默认

**Files:**
- Modify: [docker-compose.yml](file:///workspace/docker-compose.yml#L25-L73)

- [ ] 将 `JWT_SECRET_KEY=${JWT_SECRET_KEY:-change-me-in-production}` 改为 `JWT_SECRET_KEY=${JWT_SECRET_KEY:-}`（让后端开发模式自动生成逻辑接管）

---

### Task 3: 回归验证

- [ ] 后端全量单测

```bash
mkdir -p /workspace/data
python -m unittest discover -s backend/tests -p 'test_*.py' -v
```

