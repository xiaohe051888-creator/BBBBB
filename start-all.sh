#!/bin/bash

# ============================================================
# 百家乐分析预测系统 - 一键启动脚本
# 功能：清理端口 → 健康检测 → 启动服务
# ============================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 端口配置
BACKEND_PORT=8000
FRONTEND_PORT=5173

# 日志文件
LOG_DIR="logs"
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"

# 创建日志目录
mkdir -p $LOG_DIR

# ============================================================
# 函数定义
# ============================================================

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  百家乐分析预测系统 - 一键启动${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

print_step() {
    echo -e "${YELLOW}[步骤 $1/5]${NC} $2"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# 清理端口
cleanup_ports() {
    print_step "1" "清理端口占用..."
    
    # 清理后端端口
    local backend_pid=$(lsof -ti :$BACKEND_PORT 2>/dev/null || echo "")
    if [ -n "$backend_pid" ]; then
        kill -9 $backend_pid 2>/dev/null || true
        print_success "已清理后端端口 $BACKEND_PORT (PID: $backend_pid)"
    else
        print_info "后端端口 $BACKEND_PORT 未被占用"
    fi
    
    # 清理前端端口
    local frontend_pid=$(lsof -ti :$FRONTEND_PORT 2>/dev/null || echo "")
    if [ -n "$frontend_pid" ]; then
        kill -9 $frontend_pid 2>/dev/null || true
        print_success "已清理前端端口 $FRONTEND_PORT (PID: $frontend_pid)"
    else
        print_info "前端端口 $FRONTEND_PORT 未被占用"
    fi
    
    # 等待端口释放
    sleep 1
    echo ""
}

# 健康检测 - 代码检查
health_check_code() {
    print_step "2" "代码健康检测..."
    
    # Python语法检查
    print_info "检查 Python 语法..."
    if python3 -m py_compile backend/app/api/main.py 2>/dev/null; then
        print_success "Python 语法检查通过"
    else
        print_error "Python 语法检查失败"
        return 1
    fi
    
    # 检查后端服务模块
    if [ -d "backend/app/services/game" ]; then
        if python3 -m py_compile backend/app/services/game/*.py 2>/dev/null; then
            print_success "后端服务模块检查通过"
        else
            print_error "后端服务模块检查失败"
            return 1
        fi
    fi
    
    echo ""
}

# 健康检测 - 前端构建
health_check_frontend() {
    print_step "3" "前端构建检测..."
    
    cd frontend
    
    if [ ! -d "node_modules" ] || [ ! -d "node_modules/vite" ] || [ ! -d "node_modules/@types/node" ]; then
        print_info "安装前端依赖..."
        npm install >> ../$FRONTEND_LOG 2>&1
    fi
    
    # 构建检查
    print_info "执行前端构建..."
    if npm run build >> ../$FRONTEND_LOG 2>&1; then
        print_success "前端构建成功"
    else
        print_error "前端构建失败，查看日志: $FRONTEND_LOG"
        cd ..
        return 1
    fi
    
    cd ..
    echo ""
}

# 启动后端服务
start_backend() {
    print_step "4" "启动后端服务..."
    
    cd backend
    
    # 检查虚拟环境
    if [ -d "venv" ]; then
        source venv/bin/activate
    fi
    
    # 检查依赖
    print_info "检查 Python 依赖..."
    pip install -q -r requirements.txt 2>/dev/null || true
    
    # 启动后端
    print_info "启动后端服务 (端口: $BACKEND_PORT)..."
    nohup python -m uvicorn app.api.main:app --host 0.0.0.0 --port $BACKEND_PORT > ../$BACKEND_LOG 2>&1 &
    
    local backend_pid=$!
    echo $backend_pid > ../$LOG_DIR/backend.pid
    
    # 等待后端启动
    print_info "等待后端服务启动..."
    local count=0
    while [ $count -lt 30 ]; do
        if curl -s http://localhost:$BACKEND_PORT/health > /dev/null 2>&1 || \
           curl -s http://localhost:$BACKEND_PORT/docs > /dev/null 2>&1; then
            print_success "后端服务启动成功 (PID: $backend_pid)"
            cd ..
            echo ""
            return 0
        fi
        sleep 1
        count=$((count + 1))
        echo -n "."
    done
    
    print_error "后端服务启动超时"
    cd ..
    return 1
}

# 启动前端服务
start_frontend() {
    print_step "5" "启动前端服务..."
    
    cd frontend
    
    print_info "启动前端开发服务器 (端口: $FRONTEND_PORT)..."
    nohup npm run dev -- --host > ../$FRONTEND_LOG 2>&1 &
    
    local frontend_pid=$!
    echo $frontend_pid > ../$LOG_DIR/frontend.pid
    
    # 等待前端启动
    print_info "等待前端服务启动..."
    local count=0
    while [ $count -lt 30 ]; do
        if curl -s http://localhost:$FRONTEND_PORT > /dev/null 2>&1; then
            print_success "前端服务启动成功 (PID: $frontend_pid)"
            cd ..
            echo ""
            return 0
        fi
        sleep 1
        count=$((count + 1))
        echo -n "."
    done
    
    print_error "前端服务启动超时"
    cd ..
    return 1
}

# 最终状态检查
final_check() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  服务状态检查${NC}"
    echo -e "${BLUE}========================================${NC}"
    
    local all_ok=true
    
    # 检查后端
    if curl -s http://localhost:$BACKEND_PORT/health > /dev/null 2>&1 || \
       curl -s http://localhost:$BACKEND_PORT/docs > /dev/null 2>&1; then
        print_success "后端服务运行正常 - http://localhost:$BACKEND_PORT"
        print_info "API文档: http://localhost:$BACKEND_PORT/docs"
    else
        print_error "后端服务未响应"
        all_ok=false
    fi
    
    # 检查前端
    if curl -s http://localhost:$FRONTEND_PORT > /dev/null 2>&1; then
        print_success "前端服务运行正常 - http://localhost:$FRONTEND_PORT"
    else
        print_error "前端服务未响应"
        all_ok=false
    fi
    
    echo ""
    
    if [ "$all_ok" = true ]; then
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}  所有服务启动成功！${NC}"
        echo -e "${GREEN}========================================${NC}"
        echo ""
        echo -e "访问地址:"
        echo -e "  前端: ${BLUE}http://localhost:$FRONTEND_PORT${NC}"
        echo -e "  后端: ${BLUE}http://localhost:$BACKEND_PORT${NC}"
        echo -e "  API文档: ${BLUE}http://localhost:$BACKEND_PORT/docs${NC}"
        echo ""
        echo -e "日志文件:"
        echo -e "  后端: ${YELLOW}$BACKEND_LOG${NC}"
        echo -e "  前端: ${YELLOW}$FRONTEND_LOG${NC}"
        echo ""
        echo -e "停止服务: ${YELLOW}./stop-all.sh${NC}"
        return 0
    else
        echo -e "${RED}========================================${NC}"
        echo -e "${RED}  部分服务启动失败${NC}"
        echo -e "${RED}========================================${NC}"
        echo ""
        echo -e "查看日志排查问题:"
        echo -e "  后端: ${YELLOW}tail -f $BACKEND_LOG${NC}"
        echo -e "  前端: ${YELLOW}tail -f $FRONTEND_LOG${NC}"
        return 1
    fi
}

# ============================================================
# 主程序
# ============================================================

main() {
    print_header
    
    # 步骤1: 清理端口
    cleanup_ports
    
    # 步骤2: 代码健康检测
    health_check_code || exit 1
    
    # 步骤3: 前端构建检测
    health_check_frontend || exit 1
    
    # 步骤4: 启动后端
    start_backend || exit 1
    
    # 步骤5: 启动前端
    start_frontend || exit 1
    
    # 最终检查
    final_check
}

# 捕获中断信号
trap 'echo -e "\n${RED}启动被中断${NC}"; exit 1' INT TERM

# 运行主程序
main
