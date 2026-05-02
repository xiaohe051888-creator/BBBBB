# 部署/启动端口一致性设计

日期：2026-05-01  
目标：将本项目的“默认后端端口”统一为 8001，避免脚本、开发代理、容器、健康检查各用各的端口导致误判与排障成本升高。

## 背景问题

当前默认端口分散（旧状态）：
- 后端配置默认值与本地常用端口不一致
- 前端 dev proxy 与后端监听端口不一致
- start/stop 脚本清理的端口与实际监听端口不一致
- docker-compose 容器内部端口与 healthcheck 端口不一致

这会造成：
- 服务实际已启动，但脚本/代理/健康检查误判为离线

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
3. 文档/脚本/配置不存在与默认端口不一致的描述（除非明确写为可配置覆盖）
