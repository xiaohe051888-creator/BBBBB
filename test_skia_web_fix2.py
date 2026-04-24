from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    page.on("console", lambda msg: print(f"[{msg.type}] {msg.text}"))
    page.on("pageerror", lambda err: print(f"[PAGE ERROR] {err.message}"))
    
    print("Navigating to http://localhost:5173")
    page.goto('http://localhost:5173')
    time.sleep(5)
    
    print("Page content:")
    print(page.content()[:500])
    
    browser.close()
