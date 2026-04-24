from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('http://localhost:5173')
    page.wait_for_timeout(5000)
    
    page.locator('text="上传"').click(force=True)
    page.wait_for_timeout(1000)
    page.locator('text="庄赢 (B)"').click(force=True)
    page.locator('text="确认上传分析"').click(force=True)
    page.wait_for_timeout(2000)
    
    if page.locator('text="确定"').is_visible():
        page.locator('text="确定"').click(force=True)
        page.wait_for_timeout(1000)
        
    page.locator('text="换靴"').click(force=True)
    page.wait_for_timeout(1000)
    
    if page.locator('text="确定"').is_visible():
        page.locator('text="确定"').click(force=True)
        page.wait_for_timeout(2000)
        
    page.screenshot(path='/workspace/debug_error.png')
    browser.close()
