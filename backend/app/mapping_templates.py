"""Built-in foreign-broker mapping templates.

A template is exactly the ``mapping_config`` JSON stored on
``custom_portfolio_connections.mapping_config``. Identifiers in the config are
validated by :func:`app.custom_mapping.validate_mapping` before use.
"""

from copy import deepcopy

TFEX_SETTRADE_V1_LABEL = "TFEX / Settrade"

TFEX_SETTRADE_V1 = {
    "version": 1,
    "template": "tfex-settrade-v1",
    "timezone": "Asia/Bangkok",
    "entities": {
        "orders": {
            "schema": "usd_pct_abc",
            "table": "opened_orders",
            "filter": {"column": "symbol", "op": "like", "value": "%"},
            "columns": {
                "order_id": "orderno",
                "asset_type": "symbol",
                "side": "side",
                "qty": "volume",
                "entry_price": "price",
                "exit_price": "tp",
                "tp_price": "tp",
                "current_price": "mark_price",
                "order_status": "status",
                "remark": "remark",
                "fee": "fee",
                "realized_pl": "pl",
                "created_at": "tm",
            },
            "defaults": {
                "contract_type": "future",
                "asset_type_hint": "future",
            },
        },
        "history": {
            "schema": "usd_pct_abc",
            "table": "order_history",
            "columns": {
                "history_id": "id",
                "order_id": "orderno",
                "asset": "symbol",
                "type": "side",
                "qty": "volume",
                "entry_price": "price",
                "exit_price": "tp",
                "realized_pl": "pl",
                "fee": "fee",
                "remark": "remark",
                "entry_date": "tm",
                "exit_date": "c_tm",
                "closed_status": "c_status",
            },
        },
        "account": {
            "schema": "usd_pct_abc",
            "table": "account_history",
            "order_by": "ts",
            "columns": {
                "equity": "equity",
                "available_cash": "excessequity",
                "margin_locked": "initialmargin",
            },
        },
    },
}

MAPPING_TEMPLATES = {
    "tfex-settrade-v1": {
        "label": TFEX_SETTRADE_V1_LABEL,
        "config": TFEX_SETTRADE_V1,
    },
}


def get_template(name: str) -> dict | None:
    """Return a deep copy of the template config, or None when unknown."""
    entry = MAPPING_TEMPLATES.get(name)
    if entry is None:
        return None
    return deepcopy(entry["config"])


def list_templates() -> list[dict]:
    """Public list shape for GET /portfolios/mapping-templates."""
    return [
        {"name": name, "label": entry["label"], "config": deepcopy(entry["config"])}
        for name, entry in MAPPING_TEMPLATES.items()
    ]
