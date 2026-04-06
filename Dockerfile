# ============================================
# BBBBB 百家乐分析预测系统 - 多阶段 Dockerfile
# ============================================

# ---- 阶段1: 前端构建 ----
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --registry=https://registry.npmmirror.com
COPY frontend/ .
RUN npm run build

# ---- 阶段2: 后端运行环境 ----
FROM python:3.11-slim AS runtime

# 安装系统依赖（Playwright Chromium 需要）
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        # Playwright 系统依赖
        libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
        libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 \
        libgbm1 libpango-1.0-0 libcairo2 libasound2t64 \
        # 通用工具
        curl tini \
    && rm -rf /var/lib/apt/lists/* \
    && playwright install-deps chromium

WORKDIR /app

# 先复制依赖定义，利用 Docker 缓存层
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r backend/requirements.txt && \
    playwright install chromium

# 复制后端代码
COPY backend/ ./backend/

# 从构建阶段复制前端产物到后端静态目录
COPY --from=frontend-builder /app/frontend/dist ./backend/static

# 创建数据持久化目录
RUN mkdir -p /app/data /app/backend/static

# 环境变量默认值
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DEBUG=false \
    HOST=0.0.0.0 \
    PORT=8000 \
    LILE333_HEADLESS=true

EXPOSE 8000

# 使用 tini 作为 PID 1，确保正确的信号处理
ENTRYPOINT ["tini", "--"]
CMD ["python", "backend/main.py"]
