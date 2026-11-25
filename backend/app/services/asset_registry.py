"""Shared asset-registry operations: normalization, resolution, quotes, rename.

The registry is broker-scoped: a dashboard/order symbol (``price_symbol``) is
matched case/whitespace-insensitively inside one broker, then resolved to its
owning product. Provider keys (``sync_symbol``) and quote rows keep their case.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Iterable, Optional

from fastapi import HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    ActiveOrder,
    AssetProduct,
    AssetQuote,
    AssetSymbol,
    Broker,
    Portfolio,
    TradeHistory,
    Transaction,
)
from app.services import tfex_service
from app.services.yfinance_service import fetch_price

PRICE_SOURCES = ("yfinance", "tfex")
MARGIN_MODES = ("notional", "premium", "span")


def normalise_symbol(value: Any) -> Optional[str]:
    """``UPPER(TRIM(value))`` or None when blank."""
    if value is None:
        return None
    text_value = str(value).strip().upper()
    return text_value or None


def normalise_ticker(value: Any) -> Optional[str]:
    return normalise_symbol(value)


def normalise_price_symbol(value: Any) -> Optional[str]:
    """Provider/dashboard symbol stripped but case-preserved; None when blank."""
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def normalise_source(value: Any) -> str:
    """Quote source: ``COALESCE(NULLIF(TRIM(source), ''), '-')``."""
    text_value = (str(value) if value is not None else "").strip()
    return text_value or "-"


def quote_source(product: AssetProduct) -> str:
    return normalise_source(product.source)


def is_default_product(product: AssetProduct) -> bool:
    return (
        product.ticker is None
        and product.broker_id is None
        and product.asset_type is None
    )


def identity_value(value: Any, default: str) -> Decimal:
    """A value owned by the identity (product), or the documented default."""
    if value is not None:
        return Decimal(str(value))
    return Decimal(default)


def effective_multiplier(symbol: AssetSymbol, product: AssetProduct) -> Decimal:
    """Multiplier belongs to the identity (underlying + broker + type) only."""
    return identity_value(product.multiplier, "1")


def effective_margin_rate(symbol: AssetSymbol, product: AssetProduct) -> Decimal:
    """Margin rate belongs to the identity (underlying + broker + type) only."""
    return identity_value(product.margin_rate, "0")


def identity_contract_kind(product: AssetProduct) -> str:
    """Contract type is the identity's ``asset_type``; legacy fallback: future.

    The symbol column is retained for old databases but is never authoritative.
    """
    return (product.asset_type or "").strip().lower() or "future"


async def broker_codes(db: AsyncSession) -> dict[int, str]:
    result = await db.execute(select(Broker.id, Broker.code))
    return {row[0]: row[1] for row in result.all()}


async def broker_code(db: AsyncSession, broker_id: Optional[int]) -> Optional[str]:
    if broker_id is None:
        return None
    return (
        await db.execute(select(Broker.code).where(Broker.id == broker_id))
    ).scalar_one_or_none()


async def resolve_product(
    db: AsyncSession,
    ticker: Any,
    broker_id: Optional[int],
    asset_type: Optional[str] = None,
) -> list[AssetProduct]:
    """All products whose normalized ticker matches inside the broker scope.

    ``asset_type`` narrows the match to one identity type (compared normalized,
    case/whitespace-insensitive); omit it for the legacy ticker+broker lookup.
    """
    symbol = normalise_symbol(ticker)
    if symbol is None:
        return []
    query = select(AssetProduct).where(
        func.upper(func.trim(AssetProduct.ticker)) == symbol
    )
    if broker_id is None:
        query = query.where(AssetProduct.broker_id.is_(None))
    else:
        query = query.where(AssetProduct.broker_id == broker_id)
    if asset_type is not None:
        query = query.where(
            func.lower(func.trim(AssetProduct.asset_type))
            == str(asset_type).strip().lower()
        )
    result = await db.execute(query.order_by(AssetProduct.product_id))
    return list(result.scalars().all())


async def resolve_symbol_specs(
    db: AsyncSession,
    broker_id: Optional[int],
    symbols: Iterable[Any],
) -> dict[str, tuple[AssetSymbol, AssetProduct]]:
    """Normalized dashboard symbol -> (symbol, product) for one broker.

    Only symbols whose ``price_symbol`` matches are returned; a symbol without
    a dashboard key (price_symbol NULL) is never a contract spec.
    """
    wanted = {s for s in (normalise_symbol(value) for value in symbols) if s}
    if not wanted or broker_id is None:
        return {}
    result = await db.execute(
        select(AssetSymbol, AssetProduct)
        .join(AssetProduct, AssetProduct.product_id == AssetSymbol.product_id)
        .where(
            AssetSymbol.broker_id == broker_id,
            AssetSymbol.price_symbol.isnot(None),
            func.upper(func.trim(AssetSymbol.price_symbol)).in_(wanted),
        )
        .order_by(AssetSymbol.symbol_id)
    )
    specs: dict[str, tuple[AssetSymbol, AssetProduct]] = {}
    for symbol, product in result.all():
        key = normalise_symbol(symbol.price_symbol)
        if key and key not in specs:
            specs[key] = (symbol, product)
    return specs


async def resolve_symbol_owner(
    db: AsyncSession,
    price_symbol: Any,
    broker_id: Optional[int],
) -> Optional[tuple[AssetSymbol, AssetProduct]]:
    symbol = normalise_symbol(price_symbol)
    if symbol is None:
        return None
    specs = await resolve_symbol_specs(db, broker_id, [symbol])
    return specs.get(symbol)


async def resolve_underlyings(
    db: AsyncSession,
    pairs: Iterable[tuple[Optional[int], Any]],
) -> dict[tuple[Optional[int], str], str]:
    """``(broker_id, order symbol)`` -> owning product ticker in one query.

    This is the read-side counterpart of :func:`resolve_symbol_specs` for
    lists: the underlying of an order is the ticker of the product that owns
    its contract spec. A pair without a broker, without a symbol, or without a
    resolving spec is absent from the result, so callers render ``""``
    (unassigned) instead of inventing a product.
    """
    wanted: dict[int, set[str]] = {}
    for broker_id, symbol in pairs:
        key = normalise_symbol(symbol)
        if broker_id is None or key is None:
            continue
        wanted.setdefault(broker_id, set()).add(key)
    if not wanted:
        return {}
    rows = (
        await db.execute(
            select(
                AssetSymbol.broker_id,
                AssetSymbol.price_symbol,
                AssetProduct.ticker,
            )
            .join(AssetProduct, AssetProduct.product_id == AssetSymbol.product_id)
            .where(
                AssetSymbol.broker_id.in_(sorted(wanted)),
                AssetSymbol.price_symbol.isnot(None),
                AssetProduct.ticker.isnot(None),
                func.upper(func.trim(AssetSymbol.price_symbol)).in_(
                    sorted({symbol for group in wanted.values() for symbol in group})
                ),
            )
            .order_by(AssetSymbol.symbol_id)
        )
    ).all()
    resolved: dict[tuple[Optional[int], str], str] = {}
    for broker_id, price_symbol, ticker in rows:
        key = (broker_id, normalise_symbol(price_symbol))
        if key[1] in wanted.get(broker_id, ()) and key not in resolved:
            resolved[key] = ticker
    return resolved


async def translate_product_tickers(
    db: AsyncSession,
    broker_id: Optional[int],
    values: Optional[list[str]],
) -> Optional[list[str]]:
    """Contract symbols -> owning product tickers inside the broker scope.

    Unmatched values stay verbatim and the list order is preserved. Matching
    ignores the case of the value; the stored product ticker is used verbatim.
    """
    if not values:
        return None
    if broker_id is None:
        return list(values)
    rows = (
        await db.execute(
            select(AssetSymbol.price_symbol, AssetProduct.ticker)
            .join(AssetProduct, AssetProduct.product_id == AssetSymbol.product_id)
            .where(
                AssetSymbol.broker_id == broker_id,
                AssetSymbol.price_symbol.isnot(None),
            )
            .order_by(AssetSymbol.symbol_id)
        )
    ).all()
    contract_to_product: dict[str, str] = {}
    for price_symbol, product_ticker in rows:
        key = normalise_symbol(price_symbol)
        if key and key not in contract_to_product and product_ticker is not None:
            contract_to_product[key] = product_ticker

    translated: list[str] = []
    for value in values:
        key = normalise_symbol(value)
        translated.append(contract_to_product.get(key, value) if key else value)
    return translated


async def local_prices(
    db: AsyncSession,
    broker_id: Optional[int],
    symbols: Iterable[Any],
) -> dict[str, float]:
    """Normalized symbol -> quote price, preferring the portfolio broker row.

    Deterministic choice: the portfolio broker row first, otherwise the lowest
    broker id. A NULL price is treated as missing (never replaced by another
    broker's price).
    """
    wanted = {s for s in (normalise_symbol(value) for value in symbols) if s}
    if not wanted:
        return {}
    quote_source_expr = func.coalesce(
        func.nullif(func.trim(AssetProduct.source), ""), "-"
    )
    rows = (
        await db.execute(
            select(
                AssetSymbol.price_symbol,
                AssetSymbol.broker_id,
                AssetQuote.price,
            )
            .join(AssetProduct, AssetProduct.product_id == AssetSymbol.product_id)
            .outerjoin(
                AssetQuote,
                (AssetQuote.source == quote_source_expr)
                & (AssetQuote.sync_symbol == AssetSymbol.sync_symbol),
            )
            .where(
                AssetSymbol.price_symbol.isnot(None),
                func.upper(func.trim(AssetSymbol.price_symbol)).in_(wanted),
            )
            .order_by(AssetSymbol.symbol_id)
        )
    ).all()

    best: dict[str, tuple[tuple[int, int], Any]] = {}
    for price_symbol, row_broker_id, price in rows:
        key = normalise_symbol(price_symbol)
        if key is None:
            continue
        preferred = broker_id is not None and row_broker_id == broker_id
        rank = (0 if preferred else 1, row_broker_id if row_broker_id is not None else 1_000_000_000)
        current = best.get(key)
        if current is None or rank < current[0]:
            best[key] = (rank, price)
    return {
        key: float(price)
        for key, (_, price) in best.items()
        if price is not None
    }


# ---------------------------------------------------------------------------
# Serialization
# ---------------------------------------------------------------------------

def _float(value: Any) -> Optional[float]:
    if value is None:
        return None
    return float(value)


async def quote_for(
    db: AsyncSession, product: AssetProduct, symbol: AssetSymbol
) -> Optional[AssetQuote]:
    return (
        await db.execute(
            select(AssetQuote).where(
                AssetQuote.source == quote_source(product),
                AssetQuote.sync_symbol == symbol.sync_symbol,
            )
        )
    ).scalars().first()


async def symbol_payload(
    db: AsyncSession, symbol: AssetSymbol, product: AssetProduct
) -> dict:
    quote = await quote_for(db, product, symbol)
    multiplier = identity_value(product.multiplier, "1")
    margin_rate = identity_value(product.margin_rate, "0")
    return {
        "symbol_id": symbol.symbol_id,
        "product_id": symbol.product_id,
        "price_symbol": symbol.price_symbol,
        "sync_symbol": symbol.sync_symbol,
        "contract_kind": identity_contract_kind(product),
        "option_type": symbol.option_type,
        "expiry_date": symbol.expiry_date,
        "strike_price": _float(symbol.strike_price),
        "multiplier_override": _float(symbol.multiplier_override),
        "margin_rate_override": _float(symbol.margin_rate_override),
        "multiplier_effective": float(multiplier),
        "margin_rate_effective": float(margin_rate),
        # Multiplier and margin rate are identity-owned, so a contract value is
        # always inherited. The keys stay for payload compatibility.
        "multiplier_inherited": True,
        "margin_rate_inherited": True,
        "margin_per_contract": _float(product.margin_per_contract),
        "price": _float(quote.price) if quote else None,
        "change_24h": _float(quote.change_24h) if quote else None,
        "updated_at": quote.updated_at if quote else None,
    }


async def product_payload(
    db: AsyncSession,
    product: AssetProduct,
    *,
    include_symbols: bool = False,
) -> dict:
    codes = await broker_codes(db)
    symbols = (
        await db.execute(
            select(AssetSymbol)
            .where(AssetSymbol.product_id == product.product_id)
            .order_by(AssetSymbol.symbol_id)
        )
    ).scalars().all()
    payload = {
        "product_id": product.product_id,
        "ticker": product.ticker,
        "broker_id": product.broker_id,
        "broker_code": codes.get(product.broker_id)
        if product.broker_id is not None
        else None,
        "asset_type": product.asset_type,
        "multiplier": _float(product.multiplier),
        "margin_rate": _float(product.margin_rate),
        "margin_per_contract": _float(product.margin_per_contract),
        "margin_mode": product.margin_mode,
        "source": product.source,
        "group_id": product.group_id,
        "name": product.name,
        "symbol_count": len(symbols),
    }
    if include_symbols:
        payload["symbols"] = [
            await symbol_payload(db, symbol, product) for symbol in symbols
        ]
    return payload


# ---------------------------------------------------------------------------
# Quotes
# ---------------------------------------------------------------------------

async def upsert_quote(
    db: AsyncSession,
    source: str,
    sync_symbol: str,
    price: Any,
    change_24h: Any,
) -> AssetQuote:
    quote = (
        await db.execute(
            select(AssetQuote).where(
                AssetQuote.source == source,
                AssetQuote.sync_symbol == sync_symbol,
            )
        )
    ).scalars().first()
    if quote is None:
        quote = AssetQuote(
            source=source, sync_symbol=sync_symbol, price=price, change_24h=change_24h
        )
        db.add(quote)
    else:
        quote.price = price
        quote.change_24h = change_24h
    quote.updated_at = datetime.utcnow()
    await db.flush()
    return quote


def _fetch_quote(source: str, sync_symbol: str) -> tuple[float, float]:
    if source == "tfex":
        return tfex_service.fetch_price(sync_symbol)
    return fetch_price(sync_symbol)


async def refresh_symbol_quote(
    db: AsyncSession, symbol: AssetSymbol, product: AssetProduct
) -> AssetQuote:
    """Refresh one symbol's quote.

    ``yfinance``/``tfex`` fetch from the provider; any other source keeps the
    cached values and only touches ``updated_at``. Provider failures propagate.
    """
    source = quote_source(product)
    if source in PRICE_SOURCES:
        price, change = _fetch_quote(source, symbol.sync_symbol)
        return await upsert_quote(db, source, symbol.sync_symbol, price, change)
    quote = await quote_for(db, product, symbol)
    if quote is None:
        quote = AssetQuote(
            source=source, sync_symbol=symbol.sync_symbol, price=None, change_24h=None
        )
        db.add(quote)
    quote.updated_at = datetime.utcnow()
    await db.flush()
    return quote


async def delete_quote_if_unreferenced(
    db: AsyncSession, source: str, sync_symbol: str
) -> None:
    remaining = (
        await db.execute(
            select(AssetSymbol.symbol_id)
            .join(AssetProduct, AssetProduct.product_id == AssetSymbol.product_id)
            .where(
                AssetSymbol.sync_symbol == sync_symbol,
                func.coalesce(
                    func.nullif(func.trim(AssetProduct.source), ""), "-"
                )
                == source,
            )
        )
    ).first()
    if remaining is None:
        await db.execute(
            delete(AssetQuote).where(
                AssetQuote.source == source,
                AssetQuote.sync_symbol == sync_symbol,
            )
        )


# ---------------------------------------------------------------------------
# Symbol / product validation helpers
# ---------------------------------------------------------------------------

async def find_symbol_collision(
    db: AsyncSession,
    symbol: AssetSymbol,
    broker_id: Optional[int],
    *,
    exclude_symbol_id: Optional[int] = None,
) -> Optional[tuple[AssetSymbol, AssetProduct]]:
    normalized = normalise_symbol(symbol)
    if normalized is None:
        return None
    query = (
        select(AssetSymbol, AssetProduct)
        .join(AssetProduct, AssetProduct.product_id == AssetSymbol.product_id)
        .where(
            AssetSymbol.price_symbol.isnot(None),
            func.upper(func.trim(AssetSymbol.price_symbol)) == normalized,
        )
        .order_by(AssetSymbol.symbol_id)
    )
    if broker_id is None:
        query = query.where(AssetSymbol.broker_id.is_(None))
    else:
        query = query.where(AssetSymbol.broker_id == broker_id)
    if exclude_symbol_id is not None:
        query = query.where(AssetSymbol.symbol_id != exclude_symbol_id)
    row = (await db.execute(query)).first()
    return (row[0], row[1]) if row else None


async def symbol_collision_detail(
    db: AsyncSession, row: tuple[AssetSymbol, AssetProduct], requested: str
) -> str:
    _, owner = row
    if owner.broker_id is None:
        return f"Symbol {requested} already exists on the default product"
    code = await broker_code(db, owner.broker_id)
    return (
        f"Symbol {requested} on broker {code} already belongs to product "
        f"{owner.ticker} (product_id={owner.product_id})"
    )


async def assert_option_identity_available(
    db: AsyncSession,
    product: AssetProduct,
    *,
    contract_kind: Optional[str],
    price_symbol: Optional[str],
    option_type: Optional[str],
    expiry_date,
    strike_price,
    exclude_symbol_id: Optional[int] = None,
) -> None:
    if (contract_kind or "").strip().lower() != "option":
        return
    if price_symbol:
        return
    query = select(AssetSymbol).where(
        AssetSymbol.product_id == product.product_id,
        (AssetSymbol.contract_kind == "option")
        | (func.lower(AssetSymbol.contract_kind) == "option"),
        AssetSymbol.price_symbol.is_(None),
    )
    if option_type is None and expiry_date is None and strike_price is None:
        identical = query.where(
            AssetSymbol.expiry_date.is_(None),
            AssetSymbol.strike_price.is_(None),
            AssetSymbol.option_type.is_(None),
        )
        if exclude_symbol_id is not None:
            identical = identical.where(
                AssetSymbol.symbol_id != exclude_symbol_id
            )
        if (await db.execute(identical)).scalars().first() is not None:
            raise HTTPException(400, "Option identity already exists")
        return
    if option_type is not None:
        query = query.where(AssetSymbol.option_type == option_type)
    else:
        query = query.where(AssetSymbol.option_type.is_(None))
    if expiry_date is not None:
        query = query.where(AssetSymbol.expiry_date == expiry_date)
    else:
        query = query.where(AssetSymbol.expiry_date.is_(None))
    if strike_price is not None:
        query = query.where(AssetSymbol.strike_price == strike_price)
    else:
        query = query.where(AssetSymbol.strike_price.is_(None))
    if exclude_symbol_id is not None:
        query = query.where(AssetSymbol.symbol_id != exclude_symbol_id)
    if (await db.execute(query)).scalars().first() is not None:
        raise HTTPException(
            400,
            f"Option contract already exists on product {product.ticker} "
            f"(product_id={product.product_id})",
        )


# ---------------------------------------------------------------------------
# Product rename cascade
# ---------------------------------------------------------------------------

async def rename_product_references(
    db: AsyncSession, old_ticker: str, new_ticker: str, product: AssetProduct
) -> None:
    """Rename product scalar/list references in this transaction.

    Scalar ledger columns use the historical case-sensitive comparison; the
    JSON product list and this product's own dashboard symbols use the
    normalized comparison. ``sync_symbol`` and quote rows are never touched.
    """
    from app.managed_fund_models import (
        ManagedFundHolding,
        ManagedFundOrder,
        ManagedFundOrderHistory,
    )

    references = (
        (ActiveOrder, ActiveOrder.asset_type),
        (TradeHistory, TradeHistory.asset),
        (Transaction, Transaction.asset),
        (ManagedFundHolding, ManagedFundHolding.asset),
        (ManagedFundOrder, ManagedFundOrder.asset),
        (ManagedFundOrderHistory, ManagedFundOrderHistory.asset),
        (Portfolio, Portfolio.product_ticker),
    )
    for model, column in references:
        await db.execute(
            model.__table__.update()  # type: ignore[attr-defined]
            .where(column == old_ticker)
            .values({column.name: new_ticker})
        )

    portfolio_rows = (
        await db.execute(
            select(Portfolio.portfolio_id, Portfolio.product_tickers).where(
                Portfolio.product_tickers.isnot(None)
            )
        )
    ).all()
    for portfolio_id, tickers in portfolio_rows:
        if not isinstance(tickers, list):
            continue
        replaced = [
            new_ticker if normalise_ticker(ticker) == normalise_ticker(old_ticker) else ticker
            for ticker in tickers
        ]
        if replaced != tickers:
            await db.execute(
                Portfolio.__table__.update()  # type: ignore[attr-defined]
                .where(Portfolio.portfolio_id == portfolio_id)
                .values(product_tickers=replaced)
            )

    await db.execute(
        AssetSymbol.__table__.update()  # type: ignore[attr-defined]
        .where(
            AssetSymbol.product_id == product.product_id,
            func.upper(func.trim(AssetSymbol.price_symbol))
            == normalise_ticker(old_ticker),
        )
        .values(price_symbol=new_ticker)
    )
