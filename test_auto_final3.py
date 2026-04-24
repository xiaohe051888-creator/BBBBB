from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('http://localhost:5173')
    page.wait_for_timeout(2000)
    
    page.locator('text="上传"').click()
    page.wait_for_timeout(1000)
    
    page.locator('text="庄赢 (B)"').click()
    page.locator('text="闲赢 (P)"').click()
    
    page.locator('text="确认上传分析"').click()
    page.wait_for_timeout(3000) # Wait 3 seconds for BottomSheet to fully dismiss
    
    print("Click 确定")
    page.locator('text="确定"').click(force=True)
    page.wait_for_timeout(1000)
    
    print("Click 换靴")
    page.locator('text="换靴"').click(force=True)
    page.wait_for_timeout(1000)
    
    browser.close()
