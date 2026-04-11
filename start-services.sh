#!/bin/bash
# BBBBB 百家乐分析系统 - 永久服务启动脚本
# 确保只运行一个后端(8000)和一个前端(5173)

set -e

echo "🚀 BBBBB 服务启动脚本"
echo "======================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 工作目录
WORKSPACE="/Users/ww/WorkBuddy/20260405164649/BBBBB"
BACKEND_DIR="$WORKSPACE/backend"
FRONTEND_DIR="$WORKSPACE/frontend"
LOGS_DIR="$WORKSPACE/logs"

# 创建日志目录
mkdir -p "$LOGS_DIR"

# 函数：检查端口是否被占用
check_port() {
    local port=$1
    if lsof -i :$port > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️ 端口 $port 已被占用${NC}"
        return 1
    fi
    return 0
}

# 函数：停止占用端口的进程
kill_port() {
    local port=$1
    local pids=$(lsof -t -i :$port 2>/dev/null)
    if [ -n "$pids" ]; then
        echo -e "${YELLOW}停止占用端口 $port 的进程: $pids${NC}"
        kill -9 $pids 2>/dev/null || true
        sleep 1
    fi
}

# 函数：启动后端
start_backend() {
    echo -e "\n📦 启动后端服务..."
    
    # 确保端口可用
    kill_port 8000
    
    cd "$BACKEND_DIR"
    
    # 检查虚拟环境
    if [ -d ".venv" ]; then
        source .venv/bin/activate
    elif [ -d "venv" ]; then
        source venv/bin/activate
    fi
    
    # 启动后端 (使用正确的模块路径)
    nohup uvicorn app.api.main:app --host 0.0.0.0 --port 8000 --reload > "$LOGS_DIR/backend.log" 2>&1 &
    BACKEND_PID=$!
    
    # 等待后端启动
    echo "等待后端启动..."
    for i in {1..30}; do
        if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
            echo -e "${GREEN}✅ 后端已启动 (PID: $BACKEND_PID)${NC}"
            echo "   日志: $LOGS_DIR/backend.log"
            return 0
        fi
        sleep 1
    done
    
    echo -e "${RED}❌ 后端启动失败${NC}"
    return 1
}

# 函数：启动前端
start_frontend() {
    echo -e "\n🎨 启动前端服务..."
    
    # 确保端口可用
    kill_port 5173
    
    cd "$FRONTEND_DIR"
    
    # 启动前端（强制使用5173端口）
    nohup npm run dev -- --port 5173 > "$LOGS_DIR/frontend.log" 2>&1 &
    FRONTEND_PID=$!
    
    # 等待前端启动
    echo "等待前端启动..."
    for i in {1..30}; do
        if curl -s http://localhost:5173 > /dev/null 2>&1; then
            echo -e "${GREEN}✅ 前端已启动 (PID: $FRONTEND_PID)${NC}"
            echo "   日志: $LOGS_DIR/frontend.log"
            return 0
        fi
        sleep 1
    done
    
    echo -e "${RED}❌ 前端启动失败${NC}"
    return 1
}

# 函数：显示状态
show_status() {
    echo -e "\n📊 服务状态"
    echo "=========="
    
    # 检查后端
    if lsof -i :8000 > /dev/null 2>&1; then
        BACKEND_PID=$(lsof -t -i :8000 | head -1)
        echo -e "${GREEN}✅ 后端: http://localhost:8000 (PID: $BACKEND_PID)${NC}"
    else
        echo -e "${RED}❌ 后端: 未运行${NC}"
    fi
    
    # 检查前端
    if lsof -i :5173 > /dev/null 2>&1; then
        FRONTEND_PID=$(lsof -t -i :5173 | head -1)
        echo -e "${GREEN}✅ 前端: http://localhost:5173 (PID: $FRONTEND_PID)${NC}"
    else
        echo -e "${RED}❌ 前端: 未运行${NC}"
    fi
}

# 主逻辑
case "${1:-start}" in
    start)
        echo "启动服务..."
        start_backend
        start_frontend
        show_status
        echo -e "\n${GREEN}🎉 所有服务已启动！${NC}"
        echo "   前端: http://localhost:5173"
        echo "   后端: http://localhost:8000"
        ;;
    stop)
        echo "停止服务..."
        kill_port 8000
        kill_port 5173
        echo -e "${GREEN}✅ 所有服务已停止${NC}"
        ;;
    restart)
        echo "重启服务..."
        kill_port 8000
        kill_port 5173
        sleep 2
        start_backend
        start_frontend
        show_status
        echo -e "\n${GREEN}🎉 所有服务已重启！${NC}"
        ;;
    status)
        show_status
        ;;
    logs)
        echo "查看日志 (按 Ctrl+C 退出)..."
        tail -f "$LOGS_DIR/backend.log" "$LOGS_DIR/frontend.log" 2>/dev/null || echo "日志文件不存在"
        ;;
    *)
        echo "用法: $0 {start|stop|restart|status|logs}"
        exit 1
        ;;
esac
