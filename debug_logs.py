from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    logs = []
    page.on("console", lambda msg: logs.append(f"[{msg.type}] {msg.text}"))
    page.on("pageerror", lambda err: logs.append(f"[PAGE ERROR] {err}"))
    
    print("Navigating to http://localhost:5173")
    page.goto('http://localhost:5173')
    
    # Wait for 5 seconds to collect logs
    time.sleep(5)
    
    print(f"Collected {len(logs)} logs.")
    for i, log in enumerate(logs):
        if i < 20 or i > len(logs) - 20: # print first 20 and last 20
            print(log)
        elif i == 20:
            print("... (skipping middle logs) ...")
            
    browser.close()
