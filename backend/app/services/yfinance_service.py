try:
    import yfinance as yf
    HAS_YFINANCE = True
except ImportError:
    HAS_YFINANCE = False


def fetch_price(ticker: str) -> tuple[float, float]:
    if not HAS_YFINANCE:
        raise RuntimeError("yfinance not installed")
    ticker_obj = yf.Ticker(ticker)
    hist = ticker_obj.history(period="2d")
    if hist.empty:
        raise RuntimeError(f"No price data for {ticker}")
    latest = hist["Close"].iloc[-1]
    prev = hist["Close"].iloc[-2] if len(hist) > 1 else latest
    change_pct = ((latest - prev) / prev) * 100 if prev else 0.0
    return round(float(latest), 2), round(float(change_pct), 2)
