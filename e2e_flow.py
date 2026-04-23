from playwright.sync_api import sync_playwright
import time
import sys

def run_test():
    success = True
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        def handle_console(msg):
            print(f"Browser Console [{msg.type}]: {msg.text}")
            if "error" in msg.type.lower() or "exception" in msg.text.lower():
                print(">>> WARNING: Possible crash or error detected in console!")

        page.on("console", handle_console)
        page.on("pageerror", lambda err: print(f"Browser Error: {err.message}"))

        try:
            print("1. Navigating to frontend Upload Page...")
            page.goto("http://localhost:5173")
            page.wait_for_load_state("networkidle")

            # Check if we are on upload page
            if page.locator("text=数字填充").is_visible():
                print("On Upload Page.")
            else:
                print("Not on upload page. Navigating to /upload...")
                page.goto("http://localhost:5173/upload")
                page.wait_for_load_state("networkidle")

            print("2. Uploading initial data...")
            # Click 数字填充
            page.locator("button:has-text('数字填充')").click()
            # Type data
            page.locator("input[placeholder*='数字序列']").fill("1212121212")
            # Click confirm fill
            page.locator("button:has-text('确认填充')").click()
            time.sleep(1)

            # Click upload
            page.locator("button:has-text('确认上传')").first.click()
            # Click modal confirm
            page.locator("button:has-text('确认上传并重置')").click()
            
            print("Waiting for navigation to dashboard...")
            page.wait_for_url("**/dashboard*", timeout=15000)
            page.wait_for_load_state("networkidle")
            
            print("3. Checking dashboard for AI prediction...")
            # The dashboard should show "AI分析完成" or "等待开奖" and the "开奖" button should appear
            # Wait for "开奖" button
            try:
                page.wait_for_selector("button:has-text('开奖')", timeout=30000)
                print("Prediction received, '开奖' button is visible.")
            except Exception as e:
                print("Timeout waiting for AI prediction (开奖 button).")
                page.screenshot(path="error_prediction_timeout.png", full_page=True)
                raise e

            print("4. Performing manual reveal...")
            page.locator("button:has-text('开奖')").click()
            
            # Select "庄赢"
            page.locator("text=庄赢").first.click()

            # Confirm
            page.locator("button:has-text('确认开奖结果')").click()

            print("5. Verifying next state...")
            # After reveal, wait for the modal to close
            page.wait_for_selector("button:has-text('确认开奖结果')", state="hidden", timeout=15000)
            
            # The next game number should be 74 or higher
            try:
                page.wait_for_selector("text=当前第", timeout=15000)
                print("State successfully transitioned to next game.")
            except Exception as e:
                print("Timeout waiting for '当前第'. Current text might be different.")
                page.screenshot(path="error_waiting_state.png", full_page=True)
                raise e

            print("User flow test completed successfully.")
            page.screenshot(path="success_final_state.png", full_page=True)

        except Exception as e:
            print("Test failed:", e)
            page.screenshot(path="error_exception.png", full_page=True)
            success = False
        finally:
            browser.close()

    if not success:
        sys.exit(1)

if __name__ == "__main__":
    run_test()
