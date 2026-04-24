from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    logs = []
    page.on("console", lambda msg: logs.append(f"[{msg.type}] {msg.text}"))
    
    print("Navigating to http://localhost:5173")
    page.goto('http://localhost:5173')
    page.wait_for_timeout(2000)
    
    print("Clicking '记录' tab...")
    page.locator('text="记录"').click()
    page.wait_for_timeout(2000)
    
    for l in logs:
        if "466" in l:
            print("Found 466 in log:", l)
    
    browser.close()
