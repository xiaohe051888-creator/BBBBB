#!/usr/bin/env bash
set -euo pipefail

OUT_DIR="${OUT_DIR:-./backups}"
mkdir -p "$OUT_DIR"

TS="$(date +%Y%m%d_%H%M%S)"
OUT_FILE="${OUT_FILE:-$OUT_DIR/pg_${TS}.dump}"

export PGPASSWORD="${PGPASSWORD:-}"

if [[ -n "${DATABASE_URL:-}" ]]; then
  pg_dump --format=c --no-owner --no-privileges "$DATABASE_URL" -f "$OUT_FILE"
else
  : "${PGHOST:?缺少 PGHOST}"
  : "${PGPORT:?缺少 PGPORT}"
  : "${PGUSER:?缺少 PGUSER}"
  : "${PGDATABASE:?缺少 PGDATABASE}"
  pg_dump --format=c --no-owner --no-privileges -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" "$PGDATABASE" -f "$OUT_FILE"
fi

echo "备份完成：$OUT_FILE"

