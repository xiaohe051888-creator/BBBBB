from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('http://localhost:5173')
    page.wait_for_timeout(2000)
    
    # Get bounding box of "上传"
    box = page.locator('text="上传"').bounding_box()
    
    # Click using mouse
    page.mouse.click(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
    page.wait_for_timeout(2000)
    
    visible = page.locator('text="快捷录入本靴数据"').is_visible()
    print(f"Is sheet visible after mouse click? {visible}")
    
    browser.close()
