from playwright.sync_api import sync_playwright

def run_test():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # Listen to console logs
        page.on("console", lambda msg: print(f"Browser Console [{msg.type}]: {msg.text}"))
        page.on("pageerror", lambda err: print(f"Browser Error: {err.message}"))
        
        print("Navigating to frontend...")
        page.goto("http://localhost:5173")
        page.wait_for_load_state("networkidle")
        
        print("Current URL:", page.url)
        
        # Click on something to test
        # We know we are on UploadPage initially
        print("Looking for Upload button...")
        
        try:
            upload_btn = page.locator("button", has_text="提交数据并进入预测").first
            if upload_btn.is_visible():
                print("Found upload button!")
                upload_btn.click()
                page.wait_for_timeout(2000)
            else:
                print("Upload button not visible.")
        except Exception as e:
            print("Error clicking upload:", e)
        
        page.screenshot(path="e2e_screenshot.png", full_page=True)
        print("Screenshot saved to e2e_screenshot.png")
        
        # Try to navigate to dashboard directly
        print("Navigating to dashboard...")
        page.goto("http://localhost:5173/dashboard")
        page.wait_for_load_state("networkidle")
        page.screenshot(path="e2e_dashboard.png", full_page=True)
        print("Dashboard screenshot saved to e2e_dashboard.png")

        browser.close()

if __name__ == "__main__":
    run_test()
