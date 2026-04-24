from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('http://localhost:5173')
    
    print("Checking CanvasKit errors...")
    errors = []
    page.on("pageerror", lambda err: errors.append(err.message))
    page.wait_for_timeout(5000)
    
    for err in set(errors):
        print(f"Error: {err}")
        
    browser.close()
