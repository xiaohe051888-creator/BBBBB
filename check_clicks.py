from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('http://localhost:5173')
    page.wait_for_timeout(2000)
    
    # Check if '上传' is interceptable
    btn = page.locator('text="上传"')
    box = btn.bounding_box()
    print(f"Button box: {box}")
    
    # Try to evaluate what is at the center of the button
    center_x = box['x'] + box['width'] / 2
    center_y = box['y'] + box['height'] / 2
    element_at_point = page.evaluate(f"""() => {{
        const el = document.elementFromPoint({center_x}, {center_y});
        return el ? el.outerHTML : 'null';
    }}""")
    print(f"Element at point: {element_at_point[:200]}")
    
    browser.close()
