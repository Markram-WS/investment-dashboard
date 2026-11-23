"""Pure unit tests for the mapped-order risk proxy (no database)."""

from types import SimpleNamespace

from app.risk_calc import compute_risk
from app.routers.analytics import _risk_order_proxy


RISK_ATTRS = (
    "qty",
    "current_price",
    "entry_price",
    "contract_type",
    "side",
    "option_type",
    "strike_price",
    "expiry_date",
)


def mapped_order(**overrides) -> dict:
    """A mapped order dict as fetch_mapped_orders/normalise_order_row returns it."""
    order = {
        "order_id": "S50Z25-1",
        "qty": 5.0,
        "entry_price": 700.0,
        "current_price": None,  # the foreign schema has no mark price
        "contract_type": "futures",
        "side": "long",
        "option_type": None,
        "strike_price": None,
        "expiry_date": None,
    }
    order.update(overrides)
    return order


def proxy_portfolio() -> SimpleNamespace:
    """Portfolio shape the mapped branch hands to compute_risk.

    ``product_ticker`` is None so the risk model takes its documented fallback
    (multiplier 1, margin rate 0) without touching a database session.
    """
    return SimpleNamespace(
        portfolio_id=8,
        broker_id=1,
        product_ticker=None,
        x_amount=None,
        available_cash=0,
        margin_locked=0,
    )


def test_proxy_exposes_every_attribute_risk_reads():
    order = mapped_order(
        contract_type="option",
        option_type="put",
        strike_price=680.0,
        expiry_date="2025-12-30",
    )
    proxy = _risk_order_proxy(order)

    for attr in RISK_ATTRS:
        assert hasattr(proxy, attr), attr
        assert getattr(proxy, attr) == order[attr]


def test_proxy_preserves_missing_current_price():
    proxy = _risk_order_proxy(mapped_order())
    assert proxy.current_price is None
    assert proxy.entry_price == 700.0


async def test_six_mapped_rows_become_six_equity_orders():
    orders = [mapped_order(qty=qty) for qty in (5.0, 5.0, 5.0, 5.0, 5.0, 4.0)]
    proxies = [_risk_order_proxy(order) for order in orders]
    assert len(proxies) == 6

    risk = await compute_risk(None, proxy_portfolio(), proxies)

    # Counts/size come from the mapped rows; mark falls back to entry_price,
    # so mark P/L stays 0 (the foreign schema has no mark price).
    assert risk["eq"]["orders"] == 6
    assert risk["eq"]["lots"] == 29.0
    assert risk["eq"]["avg_price"] == 700.0
    assert risk["eq"]["size0"] == 700.0 * 29.0
    assert risk["eq"]["pl"] == 0.0
    assert risk["pl_total"] == 0.0


async def test_mapped_option_rows_bucket_from_side_and_option_type():
    orders = [
        mapped_order(qty=2.0, entry_price=10.0, contract_type="option",
                     side="short", option_type="call", strike_price=720.0,
                     expiry_date="2025-12-30"),
    ]
    risk = await compute_risk(
        None, proxy_portfolio(), [_risk_order_proxy(order) for order in orders]
    )

    assert risk["eq"]["orders"] == 0
    assert risk["options"]["buckets"]["short_call"]["orders"] == 1
    assert risk["options"]["buckets"]["short_call"]["lots"] == 2.0
    assert risk["options"]["unclassified"] == 0
    assert risk["net_premium"] == 20.0


async def test_empty_order_list_keeps_zero_counts():
    risk = await compute_risk(None, proxy_portfolio(), [])

    assert risk["eq"] == {
        "orders": 0,
        "lots": 0.0,
        "avg_price": 0.0,
        "size0": 0.0,
        "size_at_x_mark": 0.0,
        "size_at_x_entry": 0.0,
        "pl": 0.0,
    }
    assert risk["options"]["unclassified"] == 0
    assert risk["options"]["net_premium"] == 0.0
    assert risk["options"]["pl"] == 0.0
    for bucket in risk["options"]["buckets"].values():
        assert bucket == {"orders": 0, "lots": 0.0, "avg_premium": 0.0, "pl": 0.0}
    assert risk["pl_total"] == 0.0
    assert risk["risk"] == 0.0
