"""TFEX quote source: delayed last price from the daily market quotation API.

The public page at /market-data/daily-market-quotation/trading-quotation-by-series
sits behind Incapsula, which hands out a cookie. Warming the page first and then
calling the series info API with an XHR-style request (JSON Accept + Referer)
returns the same last price / percent change the site renders. One warm-up
serves several symbols; a blocked response is retried once after a fresh
warm-up.
"""

import threading

import requests

TFEX_QUOTATION_PAGE = (
    "https://www.tfex.co.th/en/market-data/daily-market-quotation/"
    "trading-quotation-by-series"
    "?instrumentType=TXI_F&instrumentClass=all&contractMonth=all&series=all"
    "&tradeDateType=C"
)
TFEX_SERIES_API = "https://www.tfex.co.th/api/set/tfex/series/{symbol}/info"

UNKNOWN_SYMBOL_MESSAGE = "TFEX has no quote for this series (unknown or expired symbol)."
NO_DATA_MESSAGE = "TFEX returned no usable quote for this series."
BLOCKED_MESSAGE = "TFEX quote request was blocked; try again shortly."

WARM_UP_HEADERS = {
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
}
QUOTE_HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Referer": TFEX_QUOTATION_PAGE,
    "X-Requested-With": "XMLHttpRequest",
}

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120 Safari/537.36"
    ),
})

_warm_lock = threading.Lock()
_warmed = False


def _warm_up(force: bool = False) -> None:
    """Fetch the quotation page once so Incapsula issues its cookies."""
    global _warmed
    with _warm_lock:
        if _warmed and not force:
            return
        SESSION.get(TFEX_QUOTATION_PAGE, headers=WARM_UP_HEADERS, timeout=15)
        _warmed = True


def looks_blocked(text: str) -> bool:
    """True when the answer is an HTML page (anti-bot/error) instead of JSON."""
    if not isinstance(text, str):
        return True
    return not text.lstrip().startswith("{")


def parse_quote(payload: dict) -> tuple[float, float] | None:
    """``(last price, percent change)`` from a series-info payload, or None."""
    if not isinstance(payload, dict):
        return None
    last = payload.get("last")
    if last is None:
        return None
    try:
        return float(last), float(payload.get("percentChange") or 0.0)
    except (TypeError, ValueError):
        return None


def _get_quote(url: str) -> tuple[str, dict | None]:
    """One API attempt: ``("ok", payload)``, ``("unknown", None)`` or ``("blocked", None)``."""
    try:
        resp = SESSION.get(url, headers=QUOTE_HEADERS, timeout=15)
    except requests.RequestException:
        return "blocked", None
    if resp.status_code == 404:
        return "unknown", None
    if resp.status_code != 200 or looks_blocked(resp.text):
        return "blocked", None
    try:
        payload = resp.json()
    except ValueError:
        return "blocked", None
    if not isinstance(payload, dict):
        return "blocked", None
    return "ok", payload


def fetch_price(symbol: str) -> tuple[float, float]:
    """Latest TFEX last price and 24h percent change for a series symbol."""
    code = (symbol or "").strip()
    if not code:
        raise RuntimeError(UNKNOWN_SYMBOL_MESSAGE)
    url = TFEX_SERIES_API.format(symbol=code)

    _warm_up()
    for attempt in (1, 2):
        status, payload = _get_quote(url)
        if status == "unknown":
            raise RuntimeError(UNKNOWN_SYMBOL_MESSAGE)
        if status == "ok":
            quote = parse_quote(payload)
            if quote is None:
                raise RuntimeError(NO_DATA_MESSAGE)
            price, change = quote
            return round(price, 2), round(change, 2)
        if attempt == 1:
            _warm_up(force=True)
    raise RuntimeError(BLOCKED_MESSAGE)
