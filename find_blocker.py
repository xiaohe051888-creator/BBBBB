from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('http://localhost:5173')
    page.wait_for_timeout(3000)
    
    page.locator('text="上传"').click()
    page.wait_for_timeout(1000)
    page.locator('text="庄赢 (B)"').click()
    page.locator('text="确认上传分析"').click()
    page.wait_for_timeout(2000)
    
    if page.locator('text="确定"').is_visible():
        page.locator('text="确定"').click()
        page.wait_for_timeout(1000)
        
    page.locator('text="换靴"').click()
    page.wait_for_timeout(1000)
    
    if page.locator('text="确定"').is_visible():
        page.locator('text="确定"').click()
        page.wait_for_timeout(2000)
        if page.locator('text="确定"').is_visible():
            page.locator('text="确定"').click()
            page.wait_for_timeout(1000)
            
    if page.locator('text="关闭"').is_visible():
        page.locator('text="关闭"').click()
        page.wait_for_timeout(1000)
        
    print("Checking what is at the center of the '记录' tab...")
    box = page.locator('text="记录"').bounding_box()
    
    element_at_point = page.evaluate(f"""() => {{
        const el = document.elementFromPoint({box['x'] + box['width']/2}, {box['y'] + box['height']/2});
        return el ? el.outerHTML : 'null';
    }}""")
    print("Element covering '记录':", element_at_point[:500])
    
    browser.close()
