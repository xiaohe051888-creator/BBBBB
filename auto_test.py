from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 390, 'height': 844}) # Mobile viewport (iPhone 12)
    page = context.new_page()
    
    page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
    page.on("pageerror", lambda err: print(f"PAGE ERROR: {err}"))
    
    print("Navigating to app...")
    page.goto('http://localhost:5173')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)
    
    print("Taking initial screenshot...")
    page.screenshot(path='/workspace/screenshot_01_initial.png')
    
    print("Clicking '上传' button...")
    try:
        # Find the upload button by its text
        upload_btn = page.locator('text="上传"')
        upload_btn.click()
        page.wait_for_timeout(1000)
        page.screenshot(path='/workspace/screenshot_02_upload_clicked.png')
        
        # Click 庄 (Banker) a few times
        print("Clicking '庄赢 (B)'...")
        banker_btn = page.locator('text="庄赢 (B)"')
        if banker_btn.is_visible():
            banker_btn.click()
            page.wait_for_timeout(500)
            banker_btn.click()
            page.wait_for_timeout(500)
            page.locator('text="闲赢 (P)"').click()
            page.wait_for_timeout(500)
            
            page.screenshot(path='/workspace/screenshot_03_keys_pressed.png')
            
            print("Clicking '确认上传分析'...")
            submit_btn = page.locator('text="确认上传分析"')
            submit_btn.click()
            page.wait_for_timeout(2000)
            page.screenshot(path='/workspace/screenshot_04_submitted.png')
        else:
            print("Bottom sheet keypad not visible!")
    except Exception as e:
        print(f"Error during upload flow: {e}")
        
    print("Clicking '换靴' button...")
    try:
        page.locator('text="换靴"').click()
        page.wait_for_timeout(1000)
        page.screenshot(path='/workspace/screenshot_05_change_boot.png')
        
        # Handle the alert if it pops up (since we fallback to window.confirm on web)
        # Wait, window.confirm is handled by page.on('dialog') in playwright.
        # Let's set up a dialog handler before clicking
    except Exception as e:
        print(f"Error during change boot: {e}")

    browser.close()
