#!/bin/bash
sleep 5
echo "测试管理员登录..."
curl -X POST http://localhost:8000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"8888"}'
echo ""
echo ""
echo "测试环境变量读取..."
curl http://localhost:8000/api/config
echo ""