import httpx
import json
import time

BASE_URL = "http://localhost:8000/api"

def print_result(name, res):
    print(f"--- {name} ---")
    print(f"Status Code: {res.status_code}")
    try:
        print(f"Response: {json.dumps(res.json(), ensure_ascii=False)}")
    except:
        print(f"Text: {res.text}")
    print()

with httpx.Client() as client:
    # 1. System Status
    print_result("GET /system/state", client.get(f"{BASE_URL}/system/state"))

    # 2. Upload Games
    data = {"games": [{"game_number": 1, "result": "庄"}, {"game_number": 2, "result": "闲"}], "isNewBoot": True}
    print_result("POST /games/upload", client.post(f"{BASE_URL}/games/upload", json=data))

    time.sleep(2) # Give background tasks a moment
    
    # 3. Reveal Result (Wait, it needs game_number = 3 because next_game_number is 3)
    data = {"game_number": 3, "result": "和"}
    print_result("POST /games/reveal", client.post(f"{BASE_URL}/games/reveal", json=data))

    time.sleep(2)
    print_result("GET /system/state after reveal", client.get(f"{BASE_URL}/system/state"))
    
    # 4. End Boot
    print_result("POST /games/end-boot", client.post(f"{BASE_URL}/games/end-boot"))
