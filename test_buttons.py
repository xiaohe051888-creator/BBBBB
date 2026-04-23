from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    # Catch console logs
    page.on("console", lambda msg: print(f"Console: {msg.text}"))
    page.on("pageerror", lambda err: print(f"Page Error: {err.message}"))
    
    print("Navigating to http://localhost:5173")
    page.goto('http://localhost:5173')
    page.wait_for_load_state('networkidle')
    
    print("Trying to click '上传' button...")
    try:
        page.locator('text="上传"').click()
        print("Clicked '上传'")
        page.wait_for_timeout(1000)
    except Exception as e:
        print(f"Failed to click '上传': {e}")
        
    print("Trying to click '换靴' button...")
    try:
        page.locator('text="换靴"').click()
        print("Clicked '换靴'")
        page.wait_for_timeout(1000)
    except Exception as e:
        print(f"Failed to click '换靴': {e}")
        
    browser.close()
