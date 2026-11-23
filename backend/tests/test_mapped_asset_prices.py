"""Pure unit tests for mapped-order asset-price resolution (no database)."""

from app.routers.analytics import _order_ticker, _pick_asset_prices
from app.routers.assets import _normalise_ticker


def test_pick_prefers_the_portfolios_broker_row():
    rows = [("S50Z25", 1, 990.0), ("S50Z25", 2, 995.0)]

    assert _pick_asset_prices(rows, 2) == {"S50Z25": 995.0}


def test_pick_falls_back_to_the_lowest_broker_id():
    rows = [("S50Z25", 3, 970.0), ("S50Z25", 1, 990.0)]

    assert _pick_asset_prices(rows, None) == {"S50Z25": 990.0}


def test_pick_treats_a_null_price_as_missing():
    rows = [("S50Z25", 1, None)]

    assert _pick_asset_prices(rows, 1) == {}


def test_pick_keeps_the_preferred_brokers_null_price_missing():
    # The portfolio broker's NULL is authoritative: never replaced by another
    # broker's price (and never by the foreign mark_price).
    rows = [("S50Z25", 1, 995.0), ("S50Z25", 2, None)]

    assert _pick_asset_prices(rows, 2) == {}


def test_pick_resolves_each_ticker_independently():
    rows = [(" s50z25 ", 1, 995.0), ("pttz25", 1, 35.6)]

    assert _pick_asset_prices(rows, None) == {"S50Z25": 995.0, "PTTZ25": 35.6}


def test_pick_first_row_wins_on_identical_rank():
    rows = [("S50Z25", 1, 990.0), ("S50Z25", 1, 995.0)]

    assert _pick_asset_prices(rows, None) == {"S50Z25": 990.0}


def test_order_ticker_is_blank_safe():
    assert _order_ticker({"asset_type": " s50z25 "}) == "S50Z25"
    assert _order_ticker({"asset_type": None}) == ""
    assert _order_ticker({}) == ""


def test_normalise_ticker_matches_the_stored_form():
    assert _normalise_ticker(" s50z25 ") == "S50Z25"
    assert _normalise_ticker("   ") is None
    assert _normalise_ticker(None) is None
