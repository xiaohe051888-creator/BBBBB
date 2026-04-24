from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
    page.goto('http://localhost:5173')
    page.wait_for_timeout(2000)
    
    print("Clicking 上传...")
    page.locator('text="上传"').click()
    page.wait_for_timeout(2000)
    
    # Check if '快捷录入本靴数据' is visible
    visible = page.locator('text="快捷录入本靴数据"').is_visible()
    print(f"Is sheet visible? {visible}")
    
    if visible:
        box = page.locator('text="快捷录入本靴数据"').bounding_box()
        print(f"Sheet title box: {box}")
    
    browser.close()
