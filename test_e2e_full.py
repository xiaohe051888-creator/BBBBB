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
        page.locator('text="上传"').click(force=True)
        page.wait_for_timeout(1000)
        
        print("Entering B, P...")
        page.locator('text="庄赢 (B)"').click(force=True)
        page.wait_for_timeout(500)
        page.locator('text="闲赢 (P)"').click(force=True)
        page.wait_for_timeout(500)
        
        print("Submitting Upload...")
        page.locator('text="确认上传分析"').click(force=True)
        page.wait_for_timeout(2000)
        
        # Take screenshot of the screen right now
        page.screenshot(path='/workspace/debug_upload.png')
        
        if page.locator('text="确定"').is_visible():
            print("Found 确定 modal, clicking...")
            page.locator('text="确定"').click(force=True)
            page.wait_for_timeout(1000)
        else:
            print("NO 确定 MODAL VISIBLE!")
            
        print("Clicking 换靴...")
        page.locator('text="换靴"').click(force=True)
        page.wait_for_timeout(1000)
        
        if page.locator('text="确定"').is_visible():
            print("Confirming 换靴...")
            page.locator('text="确定"').click(force=True)
            page.wait_for_timeout(2000)
            
            if page.locator('text="确定"').is_visible():
                print("Dismissing Success modal...")
                page.locator('text="确定"').click(force=True)
                page.wait_for_timeout(1000)
                
        print("Going to Records...")
        page.locator('text="记录"').click(force=True)
        page.wait_for_timeout(2000)
        
        print("Going to Mistakes...")
        page.locator('text="错题本"').click(force=True)
        page.wait_for_timeout(2000)
        
        browser.close()

test_full_flow()
