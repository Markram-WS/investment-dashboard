"""Pure unit tests for the TFEX quote source and price-source dispatch.

No network: the HTTP session is replaced by a fake for the mapping tests.
"""

import json

import pytest

from app.routers import assets as assets_router
from app.services import tfex_service


class _Asset:
    def __init__(self, source, ticker, price_symbol=None):
        self.source = source
        self.ticker = ticker
        self.price_symbol = price_symbol


class _Response:
    def __init__(self, status_code, text):
        self.status_code = status_code
        self.text = text

    def json(self):
        return json.loads(self.text)


class _Session:
    def __init__(self, handler):
        self._handler = handler
        self.headers = {}

    def get(self, url, headers=None, timeout=None):
        return self._handler(url)


def test_parse_quote_reads_last_and_percent_change():
    payload = {"symbol": "S50Z26", "last": 992.4, "percentChange": 0.131167}
    assert tfex_service.parse_quote(payload) == (992.4, 0.131167)


def test_parse_quote_handles_strings_and_missing_change():
    assert tfex_service.parse_quote({"last": "50.32"}) == (50.32, 0.0)
    assert tfex_service.parse_quote({"last": 50.32, "percentChange": None}) == (50.32, 0.0)


def test_parse_quote_returns_none_without_usable_data():
    assert tfex_service.parse_quote({}) is None
    assert tfex_service.parse_quote({"percentChange": 1.0}) is None
    assert tfex_service.parse_quote({"last": "n/a"}) is None
    assert tfex_service.parse_quote(None) is None
    assert tfex_service.parse_quote({"bidPrice": "0.06", "offerPrice": 0}) is None
    assert tfex_service.parse_quote({"priorSettlementPrice": 0}) is None


def test_normalize_symbol_accepts_product_urls():
    urls = {
        "https://www.tfex.co.th/en/products/equity/set50-index-futures/S50Z26/intraday": "S50Z26",
        "https://www.tfex.co.th/en/products/equity/single-stock-futures/PTTH27/intraday": "PTTH27",
        "https://www.tfex.co.th/en/products/currency/usd-thb-futures/USDZ26/intraday": "USDZ26",
        "https://www.tfex.co.th/en/products/equity/set50-index-options/S50X26C1030/intraday": "S50X26C1030",
        "https://www.tfex.co.th/en/products/currency/usd-thb-options/USDX26C34.00/intraday": "USDX26C34.00",
    }
    for url, symbol in urls.items():
        assert tfex_service.normalize_symbol(url) == symbol


def test_normalize_symbol_accepts_plain_symbols_and_trailing_paths():
    assert tfex_service.normalize_symbol(" S50Z26 ") == "S50Z26"
    assert tfex_service.normalize_symbol("USDX26C34.00") == "USDX26C34.00"
    assert tfex_service.normalize_symbol("S50Z26/") == "S50Z26"
    assert (
        tfex_service.normalize_symbol(
            "https://www.tfex.co.th/en/products/equity/set50-index-futures/S50Z26"
        )
        == "S50Z26"
    )


def test_normalize_symbol_rejects_invalid_input():
    for raw in ("", "   ", None, "S50 Z26", "<script>", "S50-Z26"):
        assert tfex_service.normalize_symbol(raw) == ""


def test_parse_quote_prefers_last_over_fallbacks():
    payload = {
        "last": 992.4,
        "bidPrice": "992.4",
        "offerPrice": "992.5",
        "settlementPrice": 992.6,
        "priorSettlementPrice": 991.1,
        "percentChange": 0.131167,
    }
    assert tfex_service.parse_quote(payload) == (992.4, 0.131167)


def test_parse_quote_falls_back_to_bid_offer_mid_and_computes_change():
    payload = {
        "last": None,
        "bidPrice": "0.06",
        "offerPrice": "0.10",
        "settlementPrice": None,
        "priorSettlementPrice": 0.07,
        "percentChange": None,
    }
    price, change = tfex_service.parse_quote(payload)
    assert price == pytest.approx(0.08)
    assert change == pytest.approx(14.285714, rel=1e-6)


def test_parse_quote_falls_back_to_settlement_price():
    payload = {"last": 0, "settlementPrice": 1.5, "priorSettlementPrice": 1.4}
    price, change = tfex_service.parse_quote(payload)
    assert price == 1.5
    assert change == pytest.approx(7.142857, rel=1e-6)


def test_parse_quote_falls_back_to_prior_settlement_price():
    assert tfex_service.parse_quote({"last": None, "priorSettlementPrice": 37.04}) == (37.04, 0.0)


def test_looks_blocked_flags_html_and_accepts_json():
    assert tfex_service.looks_blocked("<html><body>Incapsula</body></html>")
    assert tfex_service.looks_blocked("Request unsuccessful")
    assert tfex_service.looks_blocked("")
    assert not tfex_service.looks_blocked('{"last": 992.4}')
    assert not tfex_service.looks_blocked('  \n{"last": 992.4}')


def test_unknown_symbol_raises_the_fixed_message(monkeypatch):
    def handler(url):
        return _Response(404, "<html>not found</html>")

    monkeypatch.setattr(tfex_service, "SESSION", _Session(handler))
    monkeypatch.setattr(tfex_service, "_warmed", False)
    with pytest.raises(RuntimeError, match="unknown or expired"):
        tfex_service.fetch_price("CPALLZ99")


def test_blocked_page_is_retried_once_after_rewarm(monkeypatch):
    api_calls = []

    def handler(url):
        if "/api/set/tfex/" in url:
            api_calls.append(url)
            return _Response(200, "<html>Incapsula challenge</html>")
        return _Response(200, "<html>warm</html>")

    monkeypatch.setattr(tfex_service, "SESSION", _Session(handler))
    monkeypatch.setattr(tfex_service, "_warmed", False)
    with pytest.raises(RuntimeError, match="blocked"):
        tfex_service.fetch_price("S50Z26")
    assert len(api_calls) == 2


def test_fetch_price_accepts_product_url_and_prices_halted_option(monkeypatch):
    api_calls = []
    payload = {
        "symbol": "USDX26C34.00",
        "last": None,
        "bidPrice": "0.06",
        "offerPrice": "0.10",
        "settlementPrice": None,
        "priorSettlementPrice": 0.07,
        "percentChange": None,
        "marketStatus": "Halt",
    }

    def handler(url):
        if "/api/set/tfex/" in url:
            api_calls.append(url)
            return _Response(200, json.dumps(payload))
        return _Response(200, "<html>warm</html>")

    monkeypatch.setattr(tfex_service, "SESSION", _Session(handler))
    monkeypatch.setattr(tfex_service, "_warmed", False)
    url = (
        "https://www.tfex.co.th/en/products/currency/usd-thb-options/"
        "USDX26C34.00/intraday"
    )
    assert tfex_service.fetch_price(url) == (0.08, 14.29)
    assert api_calls[-1].endswith("/series/USDX26C34.00/info")


def test_fetch_price_rejects_invalid_symbol_before_any_request(monkeypatch):
    def handler(url):  # pragma: no cover - must never run
        raise AssertionError(url)

    monkeypatch.setattr(tfex_service, "SESSION", _Session(handler))
    with pytest.raises(RuntimeError, match="unknown or expired"):
        tfex_service.fetch_price("S50 Z26")


def test_dispatch_uses_tfex_fetcher_and_price_symbol(monkeypatch):
    calls = []
    monkeypatch.setattr(
        tfex_service, "fetch_price", lambda s: calls.append(("tfex", s)) or (50.32, 2.17)
    )
    monkeypatch.setattr(
        assets_router, "fetch_price", lambda s: calls.append(("yfinance", s)) or (0.0, 0.0)
    )
    assert assets_router._fetch_source_price(
        _Asset("tfex", "CPALLZ25", "CPALLZ26")
    ) == (50.32, 2.17)
    assert calls == [("tfex", "CPALLZ26")]


def test_dispatch_uses_yfinance_fetcher(monkeypatch):
    calls = []
    monkeypatch.setattr(tfex_service, "fetch_price", lambda s: (1.0, 1.0))
    monkeypatch.setattr(
        assets_router, "fetch_price", lambda s: calls.append(s) or (7.5, 1.25)
    )
    assert assets_router._fetch_source_price(
        _Asset("yfinance", "TDEX", "TDEX.BK")
    ) == (7.5, 1.25)
    assert calls == ["TDEX.BK"]


def test_dispatch_falls_back_to_ticker_when_price_symbol_blank(monkeypatch):
    calls = []
    monkeypatch.setattr(
        assets_router, "fetch_price", lambda s: calls.append(s) or (1.0, 0.0)
    )
    assets_router._fetch_source_price(_Asset("yfinance", "S50Z25", None))
    assets_router._fetch_source_price(_Asset("yfinance", "S50Z25", ""))
    assert calls == ["S50Z25", "S50Z25"]
