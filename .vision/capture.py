import os
import shutil
import time
from playwright.sync_api import sync_playwright

def launch_browser(p):
    # Try system installed msedge first, then chrome, then bundled chromium
    for channel in ["msedge", "chrome", None]:
        try:
            kwargs = {"headless": True}
            if channel:
                kwargs["channel"] = channel
            print(f"Attempting to launch browser with channel={channel}...")
            browser = p.chromium.launch(**kwargs)
            print(f"Successfully launched browser with channel={channel}")
            return browser
        except Exception as e:
            print(f"Could not launch with channel={channel}: {e}")
    raise RuntimeError("Failed to launch any browser.")

def main():
    round1_dir = os.path.join(os.getcwd(), ".vision", "round-1")
    review_dir = os.path.join(os.getcwd(), "vision-review")
    os.makedirs(round1_dir, exist_ok=True)
    os.makedirs(review_dir, exist_ok=True)

    pages = [
        ("/", "home"),
        ("/dashboard", "dashboard"),
        ("/upload", "upload"),
        ("/pricing", "pricing"),
    ]

    viewports = [
        {"name": "desktop", "width": 1280, "height": 800},
        {"name": "mobile", "width": 375, "height": 812},
    ]

    base_url = "http://localhost:3003"

    with sync_playwright() as p:
        browser = launch_browser(p)
        
        for vp in viewports:
            context = browser.new_context(
                viewport={"width": vp["width"], "height": vp["height"]},
                device_scale_factor=1,
            )
            page = context.new_page()

            for path, page_name in pages:
                url = f"{base_url}{path}"
                print(f"Navigating to {url} [{vp['name']}]...")
                try:
                    page.goto(url, wait_until="networkidle", timeout=15000)
                except Exception as e:
                    print(f"Warning navigating to {url}: {e}")
                
                time.sleep(1)
                
                filename = f"{page_name}_{vp['name']}.png"
                filepath = os.path.join(round1_dir, filename)
                page.screenshot(path=filepath, full_page=True)
                print(f"Saved screenshot: {filepath}")

                review_path = os.path.join(review_dir, filename)
                shutil.copy2(filepath, review_path)
                print(f"Copied to review dir: {review_path}")
            
            context.close()
        
        browser.close()

if __name__ == "__main__":
    main()
