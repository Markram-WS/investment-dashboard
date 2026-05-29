#!/usr/bin/env python3
"""Check console errors on frontend pages using browser-use."""

import asyncio
from browser_use import Agent, Browser, ChatOpenAI

PAGES = [
    ("http://localhost:5173/", "PortfolioOverview"),
    ("http://localhost:5173/all-assets", "AllAssets"),
    ("http://localhost:5173/spread-pairing", "SpreadPairing"),
    ("http://localhost:5173/managed-fund", "ManagedFund"),
    ("http://localhost:5173/risk-analytics", "RiskAnalytics"),
    ("http://localhost:5173/analytics", "AnalyticsDashboard"),
    ("http://localhost:5173/create-portfolio", "CreateNewPortfolio"),
]


async def check_page(url: str, name: str):
    """Check a single page for console errors."""
    browser = Browser()
    try:
        agent = Agent(
            task=f"Open {url}, wait 3 seconds, then check browser console for any JavaScript errors. Report all errors found.",
            llm=ChatOpenAI(model="laguna-m.1:free"),
            browser=browser,
        )
        result = await agent.run()
        return {"page": name, "url": url, "result": str(result)}
    except Exception as e:
        return {"page": name, "url": url, "error": str(e)}
    finally:
        await browser.close()


async def main():
    print("=== Frontend Console Error Check ===\n")
    for url, name in PAGES:
        print(f"Checking {name} ({url})...")
        result = await check_page(url, name)
        if "error" in result:
            print(f"  ❌ ERROR: {result['error'][:200]}")
        else:
            print(f"  ✅ Result: {result['result'][:200]}")
        print()


if __name__ == "__main__":
    asyncio.run(main())
