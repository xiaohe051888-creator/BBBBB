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
    page.wait_for_timeout(3000)
    
    print("Checking if errors disappeared...")
    errors = [l for l in logs if 'error' in l.lower() or 'CanvasKit' in l]
    print(f"Found {len(errors)} error logs.")
    for err in set(errors):
        print(err)
        
    print("Clicking 上传...")
    try:
        page.locator('text="上传"').click()
        page.wait_for_timeout(1000)
        
        print("Clicking keys...")
        page.locator('text="庄赢 (B)"').click()
        page.wait_for_timeout(200)
        page.locator('text="闲赢 (P)"').click()
        page.wait_for_timeout(500)
        
        print("Submitting...")
        page.locator('text="确认上传分析"').click()
        page.wait_for_timeout(2000)
    except Exception as e:
        print("Failed to click:", e)
        
    print("Clicking 换靴...")
    try:
        page.locator('text="换靴"').click()
        page.wait_for_timeout(1000)
        page.locator('text="确定"').click()
        page.wait_for_timeout(1000)
        page.locator('text="确定"').nth(1).click() # Click 'Ok' on the success modal
        page.wait_for_timeout(1000)
    except Exception as e:
        print("Failed to click 换靴:", e)

    browser.close()
