"""TFEX quote source: delayed price from the daily market quotation API.

The public page at /market-data/daily-market-quotation/trading-quotation-by-series
sits behind Incapsula, which hands out a cookie. Warming the page first and then
calling the series info API with an XHR-style request (JSON Accept + Referer)
returns the same price / percent change the site renders. Symbols may be plain
series codes or product-page URLs; halted series without a last trade fall back
to the bid/offer mid, settlement price, or prior settlement price. One warm-up
serves several symbols; a blocked response is retried once after a fresh
warm-up.
"""

import re
import threading
from urllib.parse import quote, urlsplit

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

_SYMBOL_PATTERN = re.compile(r"^[A-Za-z0-9.]+$")

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


def normalize_symbol(raw: str | None) -> str:
    """Series symbol from a plain symbol or a TFEX product-page URL.

    Accepts ``S50Z26``, ``USDX26C34.00`` and product pages such as
    ``/en/products/currency/usd-thb-options/USDX26C34.00/intraday``. Returns an
    empty string when no valid series symbol is left.
    """
    text = (raw or "").strip()
    if not text:
        return ""
    segments = [part.strip() for part in urlsplit(text).path.split("/") if part.strip()]
    if not segments:
        return ""
    code = segments[-1]
    for index, segment in enumerate(segments):
        if index and segment.lower() == "intraday":
            code = segments[index - 1]
            break
    return code if _SYMBOL_PATTERN.match(code) else ""


def _float_or_none(value) -> float | None:
    """``value`` as a float, or None when it is not a number."""
    if isinstance(value, bool):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _positive_float(value) -> float | None:
    """``value`` as a float when it is greater than zero, else None."""
    number = _float_or_none(value)
    return number if number is not None and number > 0 else None


def parse_quote(payload: dict) -> tuple[float, float] | None:
    """``(price, percent change)`` from a series-info payload, or None.

    TFEX leaves ``last`` null for halted or very illiquid series, so the price
    falls back to the bid/offer mid, then the settlement price, then the prior
    settlement price. A fallback price without ``percentChange`` is compared
    against the prior settlement price.
    """
    if not isinstance(payload, dict):
        return None
    prior = _positive_float(payload.get("priorSettlementPrice"))
    price = _positive_float(payload.get("last"))
    fallback = price is None
    if price is None:
        bid = _positive_float(payload.get("bidPrice"))
        offer = _positive_float(payload.get("offerPrice"))
        if bid is not None and offer is not None:
            price = (bid + offer) / 2
    if price is None:
        price = _positive_float(payload.get("settlementPrice"))
    if price is None:
        price = prior
    if price is None:
        return None
    change = _float_or_none(payload.get("percentChange"))
    if change is None:
        change = (price - prior) / prior * 100 if fallback and prior else 0.0
    return price, change


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
    """Latest TFEX price and 24h percent change for a series symbol or product URL."""
    code = normalize_symbol(symbol)
    if not code:
        raise RuntimeError(UNKNOWN_SYMBOL_MESSAGE)
    url = TFEX_SERIES_API.format(symbol=quote(code, safe="."))

    _warm_up()
    for attempt in (1, 2):
        status, payload = _get_quote(url)
        if status == "unknown":
            raise RuntimeError(UNKNOWN_SYMBOL_MESSAGE)
        if status == "ok":
            quote_result = parse_quote(payload)
            if quote_result is None:
                raise RuntimeError(NO_DATA_MESSAGE)
            price, change = quote_result
            return round(price, 2), round(change, 2)
        if attempt == 1:
            _warm_up(force=True)
    raise RuntimeError(BLOCKED_MESSAGE)
