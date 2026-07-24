import asyncio
from playwright.async_api import async_playwright
import os

outdir = r'C:\Users\TATI\Desktop\DEV\visashot\.vision\round-1'
os.makedirs(outdir, exist_ok=True)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        viewports = [('desktop', 1280, 800), ('mobile', 375, 812)]
        pages = [
            ('home', 'http://localhost:3003/'),
            ('login', 'http://localhost:3003/login'),
            ('pricing', 'http://localhost:3003/pricing'),
        ]
        for vp_name, width, height in viewports:
            context = await browser.new_context(viewport={'width': width, 'height': height})
            page = await context.new_page()
            for page_name, url in pages:
                try:
                    await page.goto(url, timeout=15000, wait_until='networkidle')
                    await asyncio.sleep(1)
                    path = os.path.join(outdir, f'{page_name}_{vp_name}.png')
                    await page.screenshot(path=path, full_page=True)
                    print(f'CAPTURED: {path}')
                except Exception as e:
                    print(f'ERROR {url} {vp_name}: {e}')
            await context.close()
        await browser.close()

asyncio.run(main())
