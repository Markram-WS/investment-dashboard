import requests
import warnings
warnings.filterwarnings('ignore')

SESSION = requests.Session()
SESSION.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
})


def fetch_price(ticker: str) -> tuple[float, float]:
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?range=2d&interval=1d"
    resp = SESSION.get(url, timeout=15)
    if resp.status_code != 200:
        raise RuntimeError(f"Yahoo Finance API returned {resp.status_code}")
    data = resp.json()
    result = data.get("chart", {}).get("result")
    if not result:
        raise RuntimeError(f"No data for {ticker}")
    closes = result[0]["indicators"]["quote"][0]["close"]
    closes = [c for c in closes if c is not None]
    if len(closes) == 0:
        raise RuntimeError(f"No close prices for {ticker}")
    latest = closes[-1]
    prev = closes[-2] if len(closes) > 1 else latest
    change_pct = ((latest - prev) / prev) * 100 if prev else 0.0
    return round(float(latest), 2), round(float(change_pct), 2)
