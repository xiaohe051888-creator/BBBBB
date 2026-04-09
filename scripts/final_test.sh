#!/bin/bash
echo "等待后端启动..."
sleep 5

echo ""
echo "=== 测试管理员登录 ==="
RESPONSE=$(curl -s -X POST http://localhost:8000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"8888"}')

echo "响应: $RESPONSE"

# 尝试解析JSON
echo "$RESPONSE" | python3 -c "
import sys, json
try:
    data = json.loads(sys.stdin.read())
    if 'token' in data:
        print('✅ 登录成功!')
        print(f'Token: {data[\"token\"][:20]}...')
        print(f'需要修改密码: {data[\"must_change_password\"]}')
        print(f'用户名: {data[\"username\"]}')
    else:
        print('❌ 登录失败')
        print(f'错误: {data.get(\"detail\", \"未知错误\")}')
except Exception as e:
    print(f'⚠️  响应解析失败: {e}')
    print('原始响应:', sys.stdin.read())
" 2>/dev/null || echo "响应解析失败"

echo ""
echo "=== 测试前端页面 ==="
echo "前端应该运行在: http://localhost:5173"
echo "请打开浏览器访问该地址"