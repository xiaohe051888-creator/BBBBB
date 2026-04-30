#!/usr/bin/env bash
set -euo pipefail

cd backend

echo "[启动] 1/2 执行数据库迁移（alembic upgrade head）..."
if ! alembic upgrade head; then
  echo ""
  echo "[错误] 数据库迁移失败。常见原因："
  echo "1) 数据库连接参数不正确（DATABASE_URL）"
  echo "2) 数据库不可用/网络不通"
  echo "3) 迁移版本冲突或数据库版本不一致"
  echo ""
  echo "请先在 Render 的 Shell 中运行："
  echo "cd backend && alembic upgrade head"
  echo ""
  exit 1
fi

echo "[启动] 2/2 启动后端服务..."
exec uvicorn app.api.main:app --host 0.0.0.0 --port "${PORT:-8000}"

