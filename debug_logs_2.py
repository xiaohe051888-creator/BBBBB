from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    logs = []
    def handle_console(msg):
        logs.append(f"[{msg.type}] {msg.text}")
        if len(logs) % 50 == 0:
            print(f"Captured {len(logs)} logs so far... Last log: {msg.text[:100]}")
            
    page.on("console", handle_console)
    page.on("pageerror", lambda err: print(f"[PAGE ERROR] {err.message}"))
    
    print("Navigating to http://localhost:5173")
    page.goto('http://localhost:5173')
    
    # Check what happens on the page for 10 seconds
    for _ in range(10):
        time.sleep(1)
        
    print(f"Total logs captured: {len(logs)}")
    if len(logs) > 0:
        print("First 5 logs:")
        for log in logs[:5]:
            print(log)
        print("Last 5 logs:")
        for log in logs[-5:]:
            print(log)
            
    browser.close()
