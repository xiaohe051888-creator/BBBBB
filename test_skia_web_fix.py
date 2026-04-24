from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    logs = []
    page.on("console", lambda msg: logs.append(f"[{msg.type}] {msg.text}"))
    page.on("pageerror", lambda err: print(f"[PAGE ERROR] {err.message}"))
    
    print("Navigating to http://localhost:5173")
    page.goto('http://localhost:5173')
    
    # Wait for 5 seconds to collect logs
    time.sleep(5)
    
    skia_errors = [l for l in logs if "CanvasKit" in l or "PictureRecorder" in l]
    print(f"Skia related errors: {len(skia_errors)}")
    
    if len(skia_errors) > 0:
        for err in skia_errors:
            print(err)
            
    print("Checking if '原生走势图引擎' text is visible on Web...")
    visible = page.locator('text="原生走势图引擎"').is_visible()
    print(f"Fallback UI Visible: {visible}")
    
    browser.close()
