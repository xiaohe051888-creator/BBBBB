# 部署/启动端口一致性（默认 8001）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将默认后端端口统一为 8001，并同步到 dev proxy、启动脚本、docker-compose、Render 启动脚本与健康检查，减少端口错配导致的“离线/不可用”假象。

**Architecture:** 统一默认端口到 8001，但仍允许通过环境变量覆盖（如 Docker 的 PORT/BACKEND_PORT）。Docker Compose 里容器内部也改为 8001，宿主默认映射 8001。

**Tech Stack:** Bash scripts + Docker Compose + Vite proxy + FastAPI(Uvicorn)。

---

## Files

- Modify: [config.py](file:///workspace/backend/app/core/config.py#L16-L20)
- Modify: [vite.config.ts](file:///workspace/frontend/vite.config.ts#L9-L22)
- Modify: [start-all.sh](file:///workspace/start-all.sh#L17-L20)
- Modify: [stop-all.sh](file:///workspace/stop-all.sh#L16-L19)
- Modify: [render_start.sh](file:///workspace/backend/scripts/render_start.sh#L20-L21)
- Modify: [docker-compose.yml](file:///workspace/docker-compose.yml#L25-L73)
- Modify: `/workspace/Dockerfile`（如存在 EXPOSE/启动端口硬编码）

---

### Task 1: 后端默认端口改为 8001

**Files:**
- Modify: [config.py](file:///workspace/backend/app/core/config.py#L16-L20)

- [ ] 将 `BACKEND_PORT` 默认值从 8000 改为 8001（仍允许通过环境变量覆盖）。

---

### Task 2: Vite dev proxy 指向 8001

**Files:**
- Modify: [vite.config.ts](file:///workspace/frontend/vite.config.ts#L9-L22)

- [ ] 将 `/api` 与 `/ws` 的 target 从 `localhost:8000` 改为 `localhost:8001`。

---

### Task 3: start/stop 脚本默认端口改为 8001

**Files:**
- Modify: [start-all.sh](file:///workspace/start-all.sh#L17-L20)
- Modify: [stop-all.sh](file:///workspace/stop-all.sh#L16-L19)

- [ ] 将脚本里的 `BACKEND_PORT=8000` 改为 `BACKEND_PORT=8001`。

---

### Task 4: Render 启动脚本默认端口改为 8001

**Files:**
- Modify: [render_start.sh](file:///workspace/backend/scripts/render_start.sh#L20-L21)

- [ ] 将 `${PORT:-8000}` 改为 `${PORT:-8001}`。

---

### Task 5: docker-compose 容器内外端口统一为 8001

**Files:**
- Modify: [docker-compose.yml](file:///workspace/docker-compose.yml#L25-L73)

- [ ] `ports` 从 `"${BACKEND_PORT:-8000}:8000"` 改为 `"${BACKEND_PORT:-8001}:8001"`
- [ ] `healthcheck` URL 从 `localhost:8000` 改为 `localhost:8001`
- [ ] 若容器启动命令硬编码 8000，需要同步调整（Dockerfile/entrypoint）。

---

### Task 6: 回归验证

- [ ] **Backend tests**

```bash
mkdir -p /workspace/data
python -m unittest discover -s backend/tests -p 'test_*.py' -v
```

- [ ] **Frontend build**

```bash
cd /workspace/frontend && npm run build
```

- [ ] **Smoke（当前环境使用 8001）**

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:8001/
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:8001/api/system/health
```

Expected: 200 / 200

