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
    page.wait_for_timeout(2000) 
    
    # Check if modal is visible
    print("Is Success Modal visible?", page.locator('text="上传成功"').is_visible())
    
    # Click 确定
    page.locator('text="确定"').click()
    page.wait_for_timeout(1000)
    
    print("Clicking 换靴...")
    page.locator('text="换靴"').click()
    page.wait_for_timeout(1000)
    
    print("Is Confirm Modal visible?", page.locator('text="确定要结束本靴并开始深度学习吗？"').is_visible())
    
    browser.close()
