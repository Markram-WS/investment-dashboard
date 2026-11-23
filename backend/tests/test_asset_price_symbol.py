"""Pure unit tests for the asset price (provider) symbol, no network or DB."""

from app.routers.assets import AssetUpdate, _normalise_price_symbol


def test_create_falls_back_to_the_ticker_when_blank():
    assert _normalise_price_symbol(None, "S50Z25") == "S50Z25"
    assert _normalise_price_symbol("", "S50Z25") == "S50Z25"
    assert _normalise_price_symbol("   ", "S50Z25") == "S50Z25"


def test_provider_symbol_is_stripped_and_keeps_its_case():
    assert _normalise_price_symbol("  PTT.BK  ", "PTTZ25") == "PTT.BK"
    assert _normalise_price_symbol("ptt.bk", "PTTZ25") == "ptt.bk"


def test_missing_provider_symbol_without_fallback_is_null():
    # Update semantics: blank clears the override, so the fetch falls back to
    # the ticker at read time.
    assert _normalise_price_symbol(None) is None
    assert _normalise_price_symbol("") is None
    assert _normalise_price_symbol("  ") is None


def test_non_string_values_are_treated_as_blank():
    assert _normalise_price_symbol(123, "AAPL") == "AAPL"
    assert _normalise_price_symbol(123) is None


def test_update_distinguishes_omitted_from_explicitly_cleared():
    assert "price_symbol" not in AssetUpdate().model_fields_set
    assert "price_symbol" in AssetUpdate(price_symbol=None).model_fields_set
    assert "price_symbol" in AssetUpdate(price_symbol="").model_fields_set
