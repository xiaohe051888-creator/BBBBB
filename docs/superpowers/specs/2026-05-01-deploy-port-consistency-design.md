# 部署/启动端口一致性设计

日期：2026-05-01  
目标：将本项目的“默认后端端口”统一为 8001，避免脚本、开发代理、容器、健康检查各用各的端口导致误判与排障成本升高。

## 背景问题

当前默认端口分散：
- 后端配置默认 `BACKEND_PORT=8000`
- 前端 dev proxy 指向 `localhost:8000`
- start/stop 脚本默认按 8000 清理端口
- docker-compose 容器内部监听 8000、healthcheck 也指向 8000

这会造成：
- 你实际用 8001 跑服务时，脚本与代理仍指向 8000，导致“后端离线/健康检查失败”的假象

## 决策

- 默认后端端口：**8001**
- docker-compose：**容器内部也改为 8001**（保证容器内外完全一致）

## 修改范围

- 后端配置默认值：`backend/app/core/config.py`
- 开发代理：`frontend/vite.config.ts`
- 一键脚本：`start-all.sh`、`stop-all.sh`
- Render 启动脚本：`backend/scripts/render_start.sh`
- Docker Compose：`docker-compose.yml`
- Dockerfile（如有硬编码 EXPOSE/启动端口）

## 验收标准

1. 本地用 start-all 启动后，默认后端监听 8001，前端代理也能正常访问 API
2. docker compose up 后，容器内部监听 8001，宿主默认映射 8001，healthcheck 指向 8001
3. 文档/脚本/配置不存在再指向 8000 的默认值（除非明确写为可配置覆盖）

