import requests
import json
import time

BASE_URL = "http://localhost:8000/api/v1"

def print_result(name, res):
    print(f"--- {name} ---")
    print(f"Status Code: {res.status_code}")
    try:
        print(f"Response: {json.dumps(res.json(), ensure_ascii=False)}")
    except:
        print(f"Text: {res.text}")
    print()

# 1. System Status
print_result("GET /system/status", requests.get(f"{BASE_URL}/system/status"))

# 2. End Boot (Clear state)
print_result("POST /system/end_boot", requests.post(f"{BASE_URL}/system/end_boot"))

# 3. Upload Games
data = {"games": [{"game_number": 1, "result": "庄"}, {"game_number": 2, "result": "闲"}], "isNewBoot": True}
print_result("POST /games/upload", requests.post(f"{BASE_URL}/games/upload", json=data))

time.sleep(2) # Give background tasks a moment
print_result("GET /system/status after upload", requests.get(f"{BASE_URL}/system/status"))

# 4. Reveal Result
data = {"result": "和"}
print_result("POST /games/reveal", requests.post(f"{BASE_URL}/games/reveal", json=data))

time.sleep(2)
print_result("GET /system/status after reveal", requests.get(f"{BASE_URL}/system/status"))

