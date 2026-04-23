from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
    page.on("pageerror", lambda err: print(f"PAGE ERROR: {err}"))
    
    print("Navigating...")
    page.goto('http://localhost:5173')
    page.wait_for_timeout(3000)
    
    print("Clicking '上传'...")
    try:
        page.locator('text="上传"').click()
        page.wait_for_timeout(1000)
    except Exception as e:
        print(f"Failed: {e}")
        
    browser.close()
