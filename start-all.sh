#!/bin/bash
set -e

echo "Starting Backend Service..."
cd /workspace/backend
source .venv/bin/activate 2>/dev/null || true
pip install -r requirements.txt > /dev/null 2>&1
python -m uvicorn app.api.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

echo "Starting Mobile Expo Service..."
cd /workspace/mobile
npm install > /dev/null 2>&1
npm run start &
MOBILE_PID=$!

echo "All services started!"
echo "Backend: http://localhost:8000"
echo "Mobile Expo: Run 'npm run start' in /workspace/mobile or view the QR code above."

wait $BACKEND_PID $MOBILE_PID
