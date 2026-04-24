import httpx
import json

BASE_URL = "http://localhost:8000/api"
with httpx.Client() as client:
    res = client.post(f"{BASE_URL}/games/end-boot")
    print(res.status_code, res.text)
