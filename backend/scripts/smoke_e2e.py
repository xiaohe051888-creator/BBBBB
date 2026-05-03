import asyncio
import json
import sys

import httpx
import websockets


BASE = "http://localhost:8011"


async def main() -> int:
  async with httpx.AsyncClient(timeout=20.0) as c:
    r = await c.post(f"{BASE}/api/admin/login", json={"password": "8888"})
    r.raise_for_status()
    token = r.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    await c.get(f"{BASE}/api/system/state")
    await c.get(f"{BASE}/api/system/health", headers=headers)

    payload = {
      "role": "single",
      "provider": "deepseek",
      "model": "deepseek-v4-pro",
      "api_key": "",
      "base_url": "https://api.deepseek.com",
    }
    t = await c.post(f"{BASE}/api/admin/api-config/test", headers=headers, json=payload)
    t.raise_for_status()
    if not t.json().get("success"):
      raise RuntimeError(f"api-config/test failed: {t.text}")

    m = await c.post(f"{BASE}/api/system/prediction-mode", headers=headers, json={"mode": "single_ai"})
    m.raise_for_status()

    logs = await c.get(f"{BASE}/api/logs", headers=headers, params={"page": 1, "page_size": 5})
    logs.raise_for_status()

  ws_url = BASE.replace("http://", "ws://").replace("https://", "wss://") + "/ws"
  async with websockets.connect(ws_url, open_timeout=10) as ws:
    await ws.send(json.dumps({"type": "auth", "token": token}))
    await ws.send("ping")
    msg = await asyncio.wait_for(ws.recv(), timeout=10)
    if "pong" not in str(msg):
      raise RuntimeError(f"ws did not pong: {msg}")

  return 0


if __name__ == "__main__":
  try:
    raise SystemExit(asyncio.run(main()))
  except Exception as e:
    sys.stderr.write(str(e) + "\n")
    raise SystemExit(1)

