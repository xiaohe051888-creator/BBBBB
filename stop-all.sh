#!/bin/bash

# ============================================================
# 百家乐分析预测系统 - 一键停止脚本
# ============================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 端口配置
BACKEND_PORT=8001
FRONTEND_PORT=5173

LOG_DIR="logs"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  百家乐分析预测系统 - 停止服务${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 从PID文件停止
if [ -f "$LOG_DIR/backend.pid" ]; then
    PID=$(cat $LOG_DIR/backend.pid)
    if kill -0 $PID 2>/dev/null; then
        kill $PID 2>/dev/null || true
        echo -e "${GREEN}✓${NC} 已停止后端服务 (PID: $PID)"
    fi
    rm -f $LOG_DIR/backend.pid
fi

if [ -f "$LOG_DIR/frontend.pid" ]; then
    PID=$(cat $LOG_DIR/frontend.pid)
    if kill -0 $PID 2>/dev/null; then
        kill $PID 2>/dev/null || true
        echo -e "${GREEN}✓${NC} 已停止前端服务 (PID: $PID)"
    fi
    rm -f $LOG_DIR/frontend.pid
fi

# 清理端口
backend_pid=$(lsof -ti :$BACKEND_PORT 2>/dev/null || echo "")
if [ -n "$backend_pid" ]; then
    kill -9 $backend_pid 2>/dev/null || true
    echo -e "${GREEN}✓${NC} 已清理后端端口 $BACKEND_PORT"
fi

frontend_pid=$(lsof -ti :$FRONTEND_PORT 2>/dev/null || echo "")
if [ -n "$frontend_pid" ]; then
    kill -9 $frontend_pid 2>/dev/null || true
    echo -e "${GREEN}✓${NC} 已清理前端端口 $FRONTEND_PORT"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  所有服务已停止${NC}"
echo -e "${GREEN}========================================${NC}"
