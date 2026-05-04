# ============================================
# Baccarat Analysis System - Multi-stage Dockerfile
# ============================================

# ---- Stage 1: Frontend Build ----
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --registry=https://registry.npmmirror.com
COPY frontend/ .
RUN npm run build

# ---- Stage 2: Backend Runtime ----
FROM python:3.11-slim AS runtime

# Install system dependencies (curl and tini for process management)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl tini \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependencies to utilize Docker cache
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r backend/requirements.txt

# Copy backend code
COPY backend/ ./backend/

RUN rm -rf ./backend/static && mkdir -p ./backend/static

# Copy frontend static build artifacts to backend static directory
COPY --from=frontend-builder /app/frontend/dist ./backend/static

# Create data persistence directory
RUN mkdir -p /app/data /app/backend/static

# Default Environment Variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DEBUG=false \
    HOST=0.0.0.0 \
    PORT=8001 \
    BACKEND_PORT=8001

EXPOSE 8001

# Use tini as PID 1 to ensure proper signal handling
ENTRYPOINT ["tini", "--"]
CMD ["python", "backend/main.py"]
