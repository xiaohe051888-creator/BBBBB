from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    logs = []
    def handle_log(msg):
        logs.append(f"[{msg.type}] {msg.text}")
        if "WebSocket" in msg.text or "466" in msg.text or "error" in msg.text.lower():
            print(f"[{msg.type}] {msg.text}")

    page.on("console", handle_log)
    page.on("pageerror", lambda err: print(f"[PAGE ERROR] {err}"))
    
    print("Navigating to http://localhost:5173")
    page.goto('http://localhost:5173')
    
    print("Waiting 10 seconds to catch loops...")
    time.sleep(10)
    print(f"Total logs captured: {len(logs)}")
    
    browser.close()
