from playwright.sync_api import sync_playwright
import time

def test_full_flow():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 390, 'height': 844})
        page = context.new_page()
        
        page.goto('http://localhost:5173')
        page.wait_for_timeout(3000)
        
        print("Clicking 上传...")
        page.locator('text="上传"').click()
        page.wait_for_timeout(1000)
        
        print("Entering 6 results...")
        for _ in range(6):
            page.locator('text="庄赢 (B)"').click()
            page.wait_for_timeout(200)
        
        print("Submitting Upload...")
        page.locator('text="确认上传分析"').click()
        
        print("Waiting for Success Modal...")
        page.wait_for_selector('text="确定"', timeout=5000)
        page.locator('text="确定"').click()
        page.wait_for_timeout(1000)
            
        print("Clicking 换靴...")
        page.locator('text="换靴"').click()
        
        print("Waiting for Confirm Modal...")
        page.wait_for_selector('text="确定要结束本靴并开始深度学习吗？"', timeout=5000)
        page.locator('text="确定"').click()
        
        print("Waiting for Success Modal...")
        page.wait_for_selector('text="本靴已结束，进入深度学习"', timeout=5000)
        page.locator('text="确定"').click()
        page.wait_for_timeout(2000)
        
        print("Dismissing Upload Sheet if open...")
        if page.locator('text="关闭"').is_visible():
            print("Found 关闭, clicking!")
            page.locator('text="关闭"').click()
            page.wait_for_timeout(1000)
        else:
            print("No 关闭 found!")
                
        print("Going to Records...")
        page.locator('text="记录"').click()
        page.wait_for_timeout(2000)
        
        print("Going to Mistakes...")
        page.locator('text="错题本"').click()
        page.wait_for_timeout(2000)
        
        print("SUCCESS! E2E Flow complete.")
        browser.close()

test_full_flow()
