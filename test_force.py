from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('http://localhost:5173')
    page.wait_for_timeout(3000)
    
    page.locator('text="上传"').click()
    page.wait_for_timeout(1000)
    page.locator('text="庄赢 (B)"').click(force=True)
    page.wait_for_timeout(1000)
    page.screenshot(path='/workspace/debug_force.png')
    browser.close()
