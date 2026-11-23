"""Pure unit tests for the foreign-schema mapping adapter (no database)."""

import copy
from datetime import datetime
from decimal import Decimal

import pytest

from app.custom_mapping import (
    is_mapping_config_present,
    mapped_history_record,
    mapped_history_records,
    normalise_account_row,
    normalise_history_row,
    normalise_order_row,
    normalise_status,
    select_test_mapping,
    validate_mapping,
)
from app.mapping_templates import get_template, list_templates


def template() -> dict:
    config = get_template("tfex-settrade-v1")
    assert config is not None
    return config


class RowLike:
    """Attribute-access row, mimicking a driver row without a mapping API."""

    def __init__(self, **values):
        self.__dict__.update(values)


# ---------------------------------------------------------------------------
# Template / validation
# ---------------------------------------------------------------------------

def test_template_listing_shape():
    templates = list_templates()
    assert [t["name"] for t in templates] == ["tfex-settrade-v1"]
    entry = templates[0]
    assert entry["label"] == "TFEX / Settrade"
    assert entry["config"]["entities"]["orders"]["table"] == "opened_orders"
    assert entry["config"]["entities"]["history"]["table"] == "order_history"
    assert entry["config"]["entities"]["history"]["columns"]["closed_status"] == "c_status"
    assert entry["config"]["entities"]["account"]["order_by"] == "ts"


def test_get_template_returns_copy():
    first = get_template("tfex-settrade-v1")
    first["entities"]["orders"]["table"] = "mutated"
    assert get_template("tfex-settrade-v1")["entities"]["orders"]["table"] == "opened_orders"
    assert get_template("does-not-exist") is None


def test_validate_accepts_template():
    assert validate_mapping(template()) == []


def test_validate_requires_version_one():
    config = template()
    config["version"] = 2
    errors = validate_mapping(config)
    assert any("version" in e for e in errors)


def test_validate_requires_orders_and_account():
    config = template()
    del config["entities"]["account"]
    errors = validate_mapping(config)
    assert any("entity 'account' is required" in e for e in errors)


def test_validate_requires_order_columns():
    config = template()
    del config["entities"]["orders"]["columns"]["order_id"]
    errors = validate_mapping(config)
    assert any("missing required column 'order_id'" in e for e in errors)


def test_validate_rejects_bad_identifiers():
    config = template()
    config["entities"]["orders"]["schema"] = "usd-pct"
    config["entities"]["orders"]["table"] = "orders; DROP TABLE x"
    config["entities"]["orders"]["columns"]["qty"] = "volume) OR 1=1 --"
    errors = validate_mapping(config)
    assert any("'schema' must be a valid SQL identifier" in e for e in errors)
    assert any("'table' must be a valid SQL identifier" in e for e in errors)
    assert any("column 'qty' must be a valid SQL identifier" in e for e in errors)


def test_validate_rejects_bad_filter_operator():
    config = template()
    config["entities"]["orders"]["filter"]["op"] = "regex"
    errors = validate_mapping(config)
    assert any("filter op must be one of =, like, in" in e for e in errors)


def test_validate_rejects_in_filter_with_scalar_value():
    config = template()
    config["entities"]["orders"]["filter"] = {
        "column": "symbol",
        "op": "in",
        "value": "S50Z25",
    }
    errors = validate_mapping(config)
    assert any("value for 'in' must be a list" in e for e in errors)


def test_validate_rejects_missing_table_and_columns():
    config = template()
    config["entities"]["orders"] = {"schema": "usd_pct_abc"}
    errors = validate_mapping(config)
    assert any("'table' must be a valid SQL identifier" in e for e in errors)
    assert any("'columns' object" in e for e in errors)


def test_validate_rejects_non_object_config():
    assert validate_mapping([]) == ["mapping config must be a JSON object"]


# ---------------------------------------------------------------------------
# Status normalisation
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "raw,expected",
    [
        ("M", "open"),
        ("MP", "open"),
        ("m", "open"),
        ("mp", "open"),
        ("C", "cancelled"),
        ("CXL", "cancelled"),
        ("E", "expired"),
        ("E0", "expired"),
        ("R", "rejected"),
        ("RS", "rejected"),
        ("X1", "x1"),
        ("pending", "pending"),
        (None, "unknown"),
        ("  ", "unknown"),
    ],
)
def test_normalise_status(raw, expected):
    assert normalise_status(raw) == expected


# ---------------------------------------------------------------------------
# Order rows
# ---------------------------------------------------------------------------

def test_normalise_order_row_from_dict():
    entity = template()["entities"]["orders"]
    row = {
        "orderno": "O-1",
        "symbol": "S50Z25",
        "side": "LONG",
        "volume": 2,
        "price": Decimal("1000.5"),
        "tp": Decimal("1010.5"),
        "status": "MP",
        "remark": "entry note",
        "fee": 20.0,
        "pl": 200.0,
        "tm": datetime(2026, 11, 20, 10, 30),
    }
    order = normalise_order_row(row, entity)

    assert order["order_id"] == "O-1"
    assert order["asset_type"] == "S50Z25"
    assert order["side"] == "LONG"
    assert order["qty"] == 2.0
    assert order["entry_price"] == 1000.5
    assert order["exit_price"] == 1010.5
    assert order["current_price"] is None
    assert order["tp_price"] is None
    assert order["sl_price"] is None
    assert order["order_status"] == "open"
    assert order["contract_type"] == "future"
    assert order["direction"] == "LONG"
    assert order["executed_by"] == "External"
    assert order["group_id"] is None
    assert order["linked_order_id"] is None
    assert order["remark"] == "entry note"
    assert order["fee"] == 20.0
    assert order["realized_pl"] == 200.0
    assert order["created_at"] == "2026-11-20T10:30:00"


def test_normalise_order_row_row_like_and_side_map():
    entity = template()["entities"]["orders"]
    row = RowLike(
        orderno="O-2",
        symbol="S50H26",
        side="SHORT",
        volume=1,
        price=100,
        tp=90,
        status="CXL",
        remark=None,
        fee=5,
        pl=-100,
        tm=None,
    )
    order = normalise_order_row(row, entity)

    assert order["side"] == "SHORT"
    assert order["direction"] == "SHORT"
    assert order["order_status"] == "cancelled"
    assert order["created_at"] is None
    assert order["fee"] == 5.0


def test_normalise_order_row_defaults_status_when_not_mapped():
    entity = {
        "columns": {
            "order_id": "orderno",
            "asset_type": "symbol",
            "side": "side",
            "qty": "volume",
            "entry_price": "price",
        },
        "defaults": {"contract_type": "future"},
    }
    order = normalise_order_row(
        {"orderno": "O-3", "symbol": "S50", "side": "LONG", "volume": 1, "price": 1},
        entity,
    )
    assert order["order_status"] == "open"
    assert order["contract_type"] == "future"


# ---------------------------------------------------------------------------
# History rows
# ---------------------------------------------------------------------------

def test_normalise_history_row():
    entity = template()["entities"]["history"]
    row = {
        "id": 7,
        "orderno": "O-1",
        "symbol": "S50Z25",
        "side": "LONG",
        "volume": 2,
        "price": Decimal("1000"),
        "tp": Decimal("1010"),
        "pl": Decimal("500"),
        "fee": Decimal("10"),
        "remark": "closed",
        "tm": datetime(2026, 11, 18, 9, 0),
        "c_tm": datetime(2026, 11, 21, 15, 45),
    }
    history = normalise_history_row(row, entity)

    assert history["history_id"] == 7
    assert history["type"] == "LONG"
    assert history["asset"] == "S50Z25"
    assert history["amount"] == 2.0
    assert history["entry_price"] == 1000.0
    assert history["exit_price"] == 1010.0
    assert history["realized_pl"] == 500.0
    assert history["executed_by"] == "External"
    assert history["order_id"] == "O-1"
    assert history["remark"] == "closed"
    assert history["entry_date"] == "2026-11-18T09:00:00"
    assert history["exit_date"] == "2026-11-21T15:45:00"
    assert history["closed_status"] is None


def test_normalise_history_row_row_like():
    entity = template()["entities"]["history"]
    row = RowLike(
        id=8,
        orderno="O-9",
        symbol="S50H26",
        side="SHORT",
        volume=1,
        price=100,
        tp=95,
        pl=-50,
        fee=5,
        remark=None,
        tm=None,
        c_tm=None,
    )
    history = normalise_history_row(row, entity)
    assert history["history_id"] == 8
    assert history["amount"] == 1.0
    assert history["realized_pl"] == -50.0
    assert history["entry_date"] is None
    assert history["exit_date"] is None
    assert history["order_id"] == "O-9"
    assert history["entry_price"] == 100.0
    assert history["closed_status"] is None


def test_normalise_history_row_reads_closed_status_when_mapped():
    entity = template()["entities"]["history"]
    row = {"id": 9, "price": 100, "c_status": "C"}
    assert normalise_history_row(row, entity)["closed_status"] == "C"


def test_normalise_history_row_omits_closed_status_without_mapping():
    entity = {
        "table": "order_history",
        "columns": {"asset": "symbol", "exit_date": "c_tm"},
    }
    history = normalise_history_row({"symbol": "S50Z25", "c_tm": None}, entity)
    assert history["closed_status"] is None


def test_mapped_history_record_close():
    record = mapped_history_record(
        {
            "history_id": 11,
            "type": "LONG",
            "asset": "S50Z25",
            "amount": 2.0,
            "entry_price": 1000.0,
            "exit_price": 1010.0,
            "realized_pl": 500.0,
            "executed_by": "External",
            "decision_note": "target hit",
            "entry_date": "2026-11-18T09:00:00",
            "exit_date": "2026-11-21T15:45:00",
            "order_id": "O-1",
            "remark": "closed at tp",
            "closed_status": "F",
        },
        8,
        "Main (custom)",
    )
    assert record["history_id"] == 11
    assert record["portfolio_id"] == 8
    assert record["portfolio_name"] == "Main (custom)"
    assert record["remark"] == {"note": "Close"}
    assert record["order_remark"] == "closed at tp"
    assert record["close_order_id"] is None
    assert record["flow"] is None
    assert record["order_id"] == "O-1"


def test_mapped_history_record_cancelled_and_missing_status():
    cancelled = mapped_history_record(
        {"history_id": 12, "closed_status": "cancelled", "remark": None}, 8, "P"
    )
    assert cancelled["remark"] == {"note": "Canceled"}

    unknown = mapped_history_record({"history_id": 13, "closed_status": None}, 8, "P")
    assert unknown["remark"] == {"note": "Close"}
    assert unknown["order_remark"] is None
    assert unknown["history_id"] == 13


def test_mapped_history_records_applies_offset_and_limit():
    rows = [
        {"history_id": 1, "exit_date": "2026-11-01T00:00:00"},
        {"history_id": 2, "exit_date": "2026-11-03T00:00:00"},
        {"history_id": 3, "exit_date": "2026-11-02T00:00:00"},
    ]
    records = mapped_history_records(rows, 8, "P", offset=1, limit=1)
    assert [r["history_id"] for r in records] == [3]

    assert mapped_history_records(rows, 8, "P", offset=0, limit=2)[1]["history_id"] == 3
    assert [r["history_id"] for r in mapped_history_records(rows, 8, "P")] == [2, 3, 1]
    assert mapped_history_records(rows, 8, "P", offset=5, limit=10) == []
    assert mapped_history_records(rows, 8, "P", offset=0, limit=0) == []


# ---------------------------------------------------------------------------
# Account rows
# ---------------------------------------------------------------------------

def test_normalise_account_row():
    entity = template()["entities"]["account"]
    account = normalise_account_row(
        {
            "equity": Decimal("120000.25"),
            "excessequity": Decimal("80000.5"),
            "initialmargin": Decimal("40000"),
        },
        entity,
    )
    assert account == {
        "equity": 120000.25,
        "available_cash": 80000.5,
        "margin_locked": 40000.0,
    }


def test_normalise_account_row_missing_row():
    entity = template()["entities"]["account"]
    assert normalise_account_row(None, entity) is None


def test_validate_does_not_mutate_config():
    config = template()
    before = copy.deepcopy(config)
    validate_mapping(config)
    assert config == before


# ---------------------------------------------------------------------------
# Stored-connection test: which mapping is diagnosed
# ---------------------------------------------------------------------------

def test_select_test_mapping_prefers_explicit_body_mapping():
    explicit = template()
    stored = {"version": 1, "entities": {}}
    assert select_test_mapping(explicit, True, stored) is explicit


def test_select_test_mapping_returns_invalid_body_mapping_for_validation():
    # Selection never filters: a provided mapping is returned even when invalid,
    # so the route can reject it with the joined validation errors.
    invalid: dict = {}
    assert select_test_mapping(invalid, True, template()) is invalid


def test_select_test_mapping_falls_back_to_stored_mapping():
    stored = template()
    assert select_test_mapping(None, False, stored) is stored


def test_select_test_mapping_explicit_null_means_connect_only():
    assert select_test_mapping(None, True, template()) is None


def test_select_test_mapping_omitted_without_stored_mapping():
    assert select_test_mapping(None, False, None) is None


# ---------------------------------------------------------------------------
# Mapped detection
# ---------------------------------------------------------------------------

def test_is_mapping_config_present_null_is_not_mapped():
    # NULL keeps the legacy custom-portfolio behaviour (our own tables).
    assert is_mapping_config_present(None) is False


@pytest.mark.parametrize(
    "config",
    [{}, {"version": 1}, {"version": 1, "entities": {}}],
)
def test_is_mapping_config_present_any_stored_config_is_mapped(config):
    # Presence, not content, decides mapped-ness; the guard has always counted
    # even an empty stored object as mapped.
    assert is_mapping_config_present(config) is True
