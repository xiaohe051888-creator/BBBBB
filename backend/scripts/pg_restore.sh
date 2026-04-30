#!/usr/bin/env bash
set -euo pipefail

BACKUP_FILE="${1:-}"
if [[ -z "$BACKUP_FILE" || ! -f "$BACKUP_FILE" ]]; then
  echo "用法：PGPASSWORD=... DATABASE_URL=... $0 /path/to/backup.dump"
  exit 2
fi

export PGPASSWORD="${PGPASSWORD:-}"

if [[ -n "${DATABASE_URL:-}" ]]; then
  pg_restore --clean --if-exists --no-owner --no-privileges -d "$DATABASE_URL" "$BACKUP_FILE"
else
  : "${PGHOST:?缺少 PGHOST}"
  : "${PGPORT:?缺少 PGPORT}"
  : "${PGUSER:?缺少 PGUSER}"
  : "${PGDATABASE:?缺少 PGDATABASE}"
  pg_restore --clean --if-exists --no-owner --no-privileges -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" "$BACKUP_FILE"
fi

echo "恢复完成：$BACKUP_FILE"

