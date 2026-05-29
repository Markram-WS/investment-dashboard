from browser_use import Agent, Browser, ChatOpenAI
import asyncio

async def main():
    browser = Browser()
    agent = Agent(
        task='Open http://localhost:5173/all-assets and check for any console errors or page load issues. Report what you see.',
        llm=ChatOpenAI(model='gpt-4o-mini', api_key='sk-placeholder'),
        browser=browser,
    )
    # Just check if page loads
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        page = b.new_page()
        logs = []
        page.on('console', lambda msg: logs.append(f'{msg.type}: {msg.text()}') if msg.type == 'error' else None)
        page.goto('http://localhost:5173/all-assets', timeout=10000)
        page.wait_for_timeout(3000)
        print('=== Console Errors ===')
        for l in logs:
            print(l)
        if not logs:
            print('No errors')
        b.close()

asyncio.run(main())
