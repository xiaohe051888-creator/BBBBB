from playwright.sync_api import sync_playwright
import time
from collections import Counter

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    logs = []
    
    def handle_console(msg):
        logs.append(f"[{msg.type}] {msg.text}")
        
    def handle_pageerror(err):
        logs.append(f"[pageerror] {err.message}")
        
    page.on("console", handle_console)
    page.on("pageerror", handle_pageerror)
    
    print("Navigating to http://localhost:5173")
    page.goto('http://localhost:5173')
    
    print("Waiting 5 seconds to collect logs...")
    time.sleep(5)
    
    print(f"Total logs captured: {len(logs)}")
    
    counter = Counter(logs)
    print("Most common logs:")
    for log, count in counter.most_common(10):
        print(f"{count}x : {log[:200]}")
        
    browser.close()
