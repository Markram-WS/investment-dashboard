"""Asset registry API.

Root ``/assets`` keeps only the custom-portfolio flat CRUD and the mapped
read-only responses.  The main registry is exposed as broker-scoped products
and their contract symbols; legacy flat ids and sync writers are gone.
"""

from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.custom_mapping import (
    fetch_mapped_orders,
    is_mapped_portfolio,
    raise_if_mapped_readonly,
)
from app.custom_models import CustomActiveOrder, CustomAsset, CustomTransaction
from app.database import (
    get_custom_session,
    get_db,
    get_or_create_custom_engine,
    resolve_portfolio_db,
)
from app.models import (
    ActiveOrder,
    AssetProduct,
    AssetSymbol,
    CustomPortfolioConnection,
    Portfolio,
)
from app.managed_fund_models import ManagedFundHolding, ManagedFundOrder
from app.routers.managed_funds import reprice_holdings_for_symbols
from app.services import asset_registry as registry

from app.services import tfex_service
from app.services.yfinance_service import fetch_price

logger = logging.getLogger(__name__)

MAIN_ROOT_DETAIL = "Use /assets/products for the main asset registry"

router = APIRouter()


# ---------------------------------------------------------------------------
# Custom flat branch (unchanged response shape)
# ---------------------------------------------------------------------------

class AssetResponse(BaseModel):
    asset_id: int
    ticker: str
    price_symbol: Optional[str] = None
    asset_type: str
    name: Optional[str] = None
    source: str = 'manual'
    group_id: Optional[int] = None
    price: Optional[float] = None
    change_24h: Optional[float] = None
    updated_at: Optional[datetime] = None
    broker_id: Optional[int] = None
    broker_code: Optional[str] = None
    multiplier: Optional[float] = 1
    margin_rate: Optional[float] = 0

    class Config:
        from_attributes = True


class AssetCreate(BaseModel):
    ticker: str
    price_symbol: Optional[str] = None
    asset_type: str = 'stock'
    name: Optional[str] = None
    source: str = 'manual'
    group_id: Optional[int] = None
    broker_id: Optional[int] = 1
    multiplier: Optional[float] = 1
    margin_rate: Optional[float] = 0


class AssetUpdate(BaseModel):
    ticker: Optional[str] = None
    name: Optional[str] = None
    price_symbol: Optional[str] = None
    asset_type: Optional[str] = None
    source: Optional[str] = None
    group_id: Optional[int] = None
    price: Optional[float] = None
    change_24h: Optional[float] = None
    multiplier: Optional[float] = None
    margin_rate: Optional[float] = None


def _asset_payload(asset, broker_codes: dict) -> dict:
    broker_id = getattr(asset, "broker_id", None)
    return {
        "asset_id": asset.asset_id,
        "ticker": asset.ticker,
        "price_symbol": getattr(asset, "price_symbol", None),
        "asset_type": asset.asset_type,
        "name": asset.name,
        "source": asset.source,
        "group_id": asset.group_id,
        "price": asset.price,
        "change_24h": asset.change_24h,
        "updated_at": asset.updated_at,
        "broker_id": broker_id,
        "broker_code": broker_codes.get(broker_id) if broker_id is not None else None,
        "multiplier": getattr(asset, "multiplier", None),
        "margin_rate": getattr(asset, "margin_rate", None),
    }


def _normalise_ticker(value) -> str | None:
    """Asset ticker in the dashboard's stored form, or None when blank."""
    return registry.normalise_ticker(value)


def _normalise_price_symbol(value, fallback: str | None = None) -> str | None:
    """Provider symbol for the price feed, or ``fallback`` when blank.

    Unlike the dashboard ticker it is only stripped, never uppercased: Yahoo
    Finance symbols are case-sensitive (``PTT.BK``).
    """
    if isinstance(value, str) and value.strip():
        return value.strip()
    return fallback


def _fetch_source_price(asset) -> tuple[float, float]:
    """Fetch ``(price, change_24h)`` from the asset's configured provider."""
    symbol = asset.price_symbol or asset.ticker
    if asset.source == 'tfex':
        return tfex_service.fetch_price(symbol)
    return fetch_price(symbol)


@router.get("", response_model=List[AssetResponse], tags=["assets"])
async def list_assets(
    group_id: Optional[int] = Query(None),
    asset_type: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    portfolio_id: Optional[int] = None,
):
    if await is_mapped_portfolio(db, portfolio_id):
        return []
    session, is_custom = await resolve_portfolio_db(db, portfolio_id)
    if not is_custom:
        raise HTTPException(404, MAIN_ROOT_DETAIL)
    try:
        query = select(CustomAsset)
        if group_id is not None:
            query = query.where(CustomAsset.group_id == group_id)
        if asset_type:
            query = query.where(CustomAsset.asset_type == asset_type)
        if source:
            query = query.where(CustomAsset.source == source)
        query = query.order_by(CustomAsset.ticker)
        assets = (await session.execute(query)).scalars().all()
        return [_asset_payload(asset, {}) for asset in assets]
    finally:
        await session.close()


@router.post("", response_model=AssetResponse, status_code=201, tags=["assets"])
async def create_asset(
    data: AssetCreate,
    db: AsyncSession = Depends(get_db),
    portfolio_id: Optional[int] = None,
):
    await raise_if_mapped_readonly(db, portfolio_id)
    session, is_custom = await resolve_portfolio_db(db, portfolio_id)
    if not is_custom:
        raise HTTPException(404, MAIN_ROOT_DETAIL)
    try:
        if data.multiplier is not None and data.multiplier <= 0:
            raise HTTPException(400, "multiplier must be greater than 0")
        if data.margin_rate is not None and not (0 <= data.margin_rate <= 1):
            raise HTTPException(400, "margin_rate must be between 0 and 1")
        existing = await session.execute(
            select(CustomAsset).where(CustomAsset.ticker == data.ticker.upper())
        )
        if existing.scalars().first():
            raise HTTPException(400, "Asset with this ticker already exists")
        asset = CustomAsset(
            ticker=data.ticker.upper(),
            price_symbol=_normalise_price_symbol(data.price_symbol, data.ticker.upper()),
            asset_type=data.asset_type,
            name=data.name or data.ticker.upper(),
            source=data.source,
            group_id=data.group_id,
        )
        session.add(asset)
        await session.commit()
        await session.refresh(asset)
        return _asset_payload(asset, {})
    finally:
        await session.close()


@router.put("/{asset_id}", response_model=AssetResponse, tags=["assets"])
async def update_asset(
    asset_id: int,
    data: AssetUpdate,
    db: AsyncSession = Depends(get_db),
    portfolio_id: Optional[int] = None,
):
    await raise_if_mapped_readonly(db, portfolio_id)
    session, is_custom = await resolve_portfolio_db(db, portfolio_id)
    if not is_custom:
        raise HTTPException(404, MAIN_ROOT_DETAIL)
    try:
        asset = (
            await session.execute(
                select(CustomAsset).where(CustomAsset.asset_id == asset_id)
            )
        ).scalars().first()
        if not asset:
            raise HTTPException(404, "Asset not found")
        if data.multiplier is not None and data.multiplier <= 0:
            raise HTTPException(400, "multiplier must be greater than 0")
        if data.margin_rate is not None and not (0 <= data.margin_rate <= 1):
            raise HTTPException(400, "margin_rate must be between 0 and 1")
        if data.ticker is not None:
            new_ticker = (data.ticker or "").strip().upper()
            if not new_ticker:
                raise HTTPException(400, "Ticker is required")
            old_ticker = asset.ticker
            if new_ticker != (old_ticker or "").upper():
                duplicate = await session.execute(
                    select(CustomAsset).where(
                        CustomAsset.ticker == new_ticker,
                        CustomAsset.asset_id != asset.asset_id,
                    )
                )
                if duplicate.scalars().first():
                    raise HTTPException(400, "An asset with this ticker already exists")
                for model, column in (
                    (CustomActiveOrder, CustomActiveOrder.asset_type),
                    (CustomTransaction, CustomTransaction.asset),
                ):
                    await session.execute(
                        update(model)
                        .where(column == old_ticker)
                        .values({column.name: new_ticker})
                    )
                asset.ticker = new_ticker
                if not asset.name or asset.name == old_ticker:
                    asset.name = new_ticker
        if "price_symbol" in data.model_fields_set:
            asset.price_symbol = _normalise_price_symbol(data.price_symbol)
        for field in (
            "name", "asset_type", "source", "group_id", "price", "change_24h",
        ):
            value = getattr(data, field, None)
            if value is None:
                continue
            setattr(asset, field, value)
        asset.updated_at = datetime.utcnow()
        await session.commit()
        await session.refresh(asset)
        return _asset_payload(asset, {})
    finally:
        await session.close()


@router.delete("/{asset_id}", status_code=204, tags=["assets"])
async def delete_asset(
    asset_id: int,
    db: AsyncSession = Depends(get_db),
    portfolio_id: Optional[int] = None,
):
    await raise_if_mapped_readonly(db, portfolio_id)
    session, is_custom = await resolve_portfolio_db(db, portfolio_id)
    if not is_custom:
        raise HTTPException(404, MAIN_ROOT_DETAIL)
    try:
        asset = (
            await session.execute(
                select(CustomAsset).where(CustomAsset.asset_id == asset_id)
            )
        ).scalars().first()
        if not asset:
            raise HTTPException(404, "Asset not found")
        await session.delete(asset)
        await session.commit()
    finally:
        await session.close()


# The legacy order-derived sync writers are removed. These explicit 404s make
# the removal unambiguous even though the dynamic custom routes share the path
# prefix.
@router.post("/sync-from-orders", status_code=404, include_in_schema=False)
async def legacy_sync_from_orders_removed():
    raise HTTPException(404, "Not Found")


@router.post("/sync-from-all", status_code=404, include_in_schema=False)
async def legacy_sync_from_all_removed():
    raise HTTPException(404, "Not Found")


# ---------------------------------------------------------------------------
# Products
# ---------------------------------------------------------------------------

class ProductCreate(BaseModel):
    ticker: Optional[str] = None
    broker_id: Optional[int] = None
    asset_type: Optional[str] = None
    multiplier: Optional[float] = None
    margin_rate: Optional[float] = None
    margin_mode: Optional[str] = None
    margin_per_contract: Optional[float] = None
    source: Optional[str] = None
    group_id: Optional[int] = None
    name: Optional[str] = None


class ProductUpdate(BaseModel):
    ticker: Optional[str] = None
    broker_id: Optional[int] = None
    asset_type: Optional[str] = None
    multiplier: Optional[float] = None
    margin_rate: Optional[float] = None
    margin_mode: Optional[str] = None
    margin_per_contract: Optional[float] = None
    source: Optional[str] = None
    group_id: Optional[int] = None
    name: Optional[str] = None


class SymbolCreate(BaseModel):
    price_symbol: Optional[str] = None
    sync_symbol: Optional[str] = None
    contract_kind: Optional[str] = None
    option_type: Optional[str] = None
    expiry_date: Optional[date] = None
    strike_price: Optional[float] = None
    multiplier_override: Optional[float] = None
    margin_rate_override: Optional[float] = None
    margin_per_contract: Optional[float] = None


class SymbolUpdate(BaseModel):
    product_id: Optional[int] = None
    price_symbol: Optional[str] = None
    sync_symbol: Optional[str] = None
    contract_kind: Optional[str] = None
    option_type: Optional[str] = None
    expiry_date: Optional[date] = None
    strike_price: Optional[float] = None
    multiplier_override: Optional[float] = None
    margin_rate_override: Optional[float] = None
    margin_per_contract: Optional[float] = None


class QuoteUpdate(BaseModel):
    price: Optional[float] = None
    change_24h: Optional[float] = None


class SyncChoice(BaseModel):
    symbol: str
    broker_id: Optional[int] = None
    product_id: Optional[int] = None
    create_product: Optional[bool] = None
    create_underlying: Optional[str] = None
    create_source: Optional[str] = None
    create_sync_symbol: Optional[str] = None
    create_asset_type: Optional[str] = None


class SyncApplyRequest(BaseModel):
    choices: List[SyncChoice] = []


def _validate_product_values(
    multiplier: Optional[float],
    margin_rate: Optional[float],
    margin_mode: Optional[str],
    margin_per_contract: Optional[float] = None,
) -> None:
    if multiplier is not None and multiplier <= 0:
        raise HTTPException(400, "multiplier must be greater than 0")
    if margin_rate is not None and not (0 <= margin_rate <= 1):
        raise HTTPException(400, "margin_rate must be between 0 and 1")
    if margin_per_contract is not None and margin_per_contract < 0:
        raise HTTPException(
            400, "margin_per_contract must be zero or greater"
        )
    if margin_mode is not None and margin_mode not in registry.MARGIN_MODES:
        raise HTTPException(400, "margin_mode must be one of notional, premium, span")


def _validate_symbol_values(
    multiplier_override: Optional[float],
    margin_rate_override: Optional[float],
    margin_per_contract: Optional[float] = None,
) -> None:
    """Identity-owned values: multiplier, margin rate and span margin."""
    if multiplier_override is not None:
        raise HTTPException(
            400,
            "multiplier is set on the underlying + broker + type, not on the contract",
        )
    if margin_rate_override is not None:
        raise HTTPException(
            400,
            "margin_rate is set on the underlying + broker + type, not on the contract",
        )
    if margin_per_contract is not None:
        raise HTTPException(
            400,
            "margin per contract is set on the underlying + broker + type, "
            "not on the contract",
        )


def _validate_contract_kind(
    product: AssetProduct, supplied: Optional[str]
) -> str:
    """Contract type belongs to the identity; return the value to store.

    A supplied type must equal the owning product's ``asset_type``. An identity
    without a type keeps the legacy ``future`` fallback so old contracts still
    render, but the symbol column is never authoritative.
    """
    identity_kind = (product.asset_type or "").strip().lower() or "future"
    supplied_kind = (supplied or "").strip().lower()
    if supplied_kind and supplied_kind != identity_kind:
        raise HTTPException(
            400, "contract type is set by the underlying + broker + type"
        )
    return identity_kind


def _identity_filter(ticker: Optional[str], broker_id: Optional[int], asset_type: Optional[str]):
    clauses = []
    for column, value in (
        (AssetProduct.ticker, ticker),
        (AssetProduct.broker_id, broker_id),
        (AssetProduct.asset_type, asset_type),
    ):
        clauses.append(column.is_(None) if value is None else column == value)
    return clauses


async def _identity_exists(
    db: AsyncSession,
    ticker: Optional[str],
    broker_id: Optional[int],
    asset_type: Optional[str],
    *,
    exclude_product_id: Optional[int] = None,
) -> bool:
    query = select(AssetProduct.product_id).where(
        *_identity_filter(ticker, broker_id, asset_type)
    )
    if exclude_product_id is not None:
        query = query.where(AssetProduct.product_id != exclude_product_id)
    return (await db.execute(query.limit(1))).first() is not None


async def _product_or_404(db: AsyncSession, product_id: int) -> AssetProduct:
    product = await db.get(AssetProduct, product_id)
    if product is None:
        raise HTTPException(404, "Product not found")
    return product


async def _default_identity_product(db: AsyncSession) -> Optional[AssetProduct]:
    """The reserved all-NULL identity row, when it exists."""
    return (
        await db.execute(
            select(AssetProduct)
            .where(*_identity_filter(None, None, None))
            .order_by(AssetProduct.product_id)
            .limit(1)
        )
    ).scalars().first()


async def _symbol_or_404(
    db: AsyncSession, symbol_id: int
) -> tuple[AssetSymbol, AssetProduct]:
    symbol = await db.get(AssetSymbol, symbol_id)
    if symbol is None:
        raise HTTPException(404, "Symbol not found")
    product = await db.get(AssetProduct, symbol.product_id)
    if product is None:
        raise HTTPException(404, "Symbol not found")
    return symbol, product


@router.get("/products", tags=["assets"])
async def list_products(
    group_id: Optional[int] = Query(None),
    asset_type: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    broker_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    query = select(AssetProduct).where(
        or_(
            AssetProduct.ticker.isnot(None),
            AssetProduct.broker_id.isnot(None),
            AssetProduct.asset_type.isnot(None),
        )
    )
    if group_id is not None:
        query = query.where(AssetProduct.group_id == group_id)
    if asset_type:
        query = query.where(AssetProduct.asset_type == asset_type)
    if source:
        query = query.where(AssetProduct.source == source)
    if broker_id is not None:
        query = query.where(AssetProduct.broker_id == broker_id)
    query = query.order_by(
        func.upper(AssetProduct.ticker).nulls_last(),
        AssetProduct.broker_id.nulls_last(),
        AssetProduct.asset_type.nulls_last(),
    )
    products = (await db.execute(query)).scalars().all()
    return [await registry.product_payload(db, product) for product in products]


@router.post("/products", status_code=201, tags=["assets"])
async def create_product(data: ProductCreate, db: AsyncSession = Depends(get_db)):
    ticker = registry.normalise_ticker(data.ticker)
    if ticker is None and data.broker_id is None and data.asset_type is None:
        # An unassigned underlying is valid only when scoped by a broker or a
        # type; the all-NULL triple is the reserved default-product identity.
        raise HTTPException(400, "Ticker is required")
    _validate_product_values(
        data.multiplier, data.margin_rate, data.margin_mode,
        data.margin_per_contract,
    )
    if await _identity_exists(db, ticker, data.broker_id, data.asset_type):
        raise HTTPException(400, "An asset with this ticker already exists")
    product = AssetProduct(
        ticker=ticker,
        broker_id=data.broker_id,
        asset_type=data.asset_type,
        multiplier=data.multiplier if data.multiplier is not None else 1,
        margin_rate=data.margin_rate if data.margin_rate is not None else 0,
        margin_mode=data.margin_mode or "notional",
        margin_per_contract=data.margin_per_contract,
        source=data.source if data.source is not None else "-",
        group_id=data.group_id,
        name=data.name,
    )
    db.add(product)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(400, "An asset with this ticker already exists")
    await db.refresh(product)
    return await registry.product_payload(db, product)


@router.get("/products/{product_id}", tags=["assets"])
async def get_product(product_id: int, db: AsyncSession = Depends(get_db)):
    product = await _product_or_404(db, product_id)
    return await registry.product_payload(db, product, include_symbols=True)


@router.put("/products/{product_id}", tags=["assets"])
async def update_product(
    product_id: int, data: ProductUpdate, db: AsyncSession = Depends(get_db)
):
    product = await _product_or_404(db, product_id)
    if registry.is_default_product(product):
        raise HTTPException(400, "The default product is not editable")
    fields = data.model_dump(exclude_unset=True)
    for field, message in (
        ("multiplier", "multiplier must be greater than 0"),
        ("margin_rate", "margin_rate must be between 0 and 1"),
        ("margin_mode", "margin_mode must be one of notional, premium, span"),
    ):
        if field in fields and fields[field] is None:
            raise HTTPException(400, message)
    _validate_product_values(
        fields.get("multiplier"),
        fields.get("margin_rate"),
        fields.get("margin_mode"),
        fields.get("margin_per_contract"),
    )

    old_ticker = product.ticker
    new_ticker = old_ticker
    effective_broker_id = fields.get("broker_id", product.broker_id)
    if "ticker" in fields:
        new_ticker = registry.normalise_ticker(fields.pop("ticker"))
        if (
            new_ticker is None
            and effective_broker_id is None
            and fields.get("asset_type", product.asset_type) is None
        ):
            # Blank is allowed while the product is scoped by a broker or a
            # type; the all-NULL triple is the reserved default identity.
            raise HTTPException(400, "Ticker is required")
        if new_ticker != old_ticker:
            if await _identity_exists(
                db,
                new_ticker,
                effective_broker_id,
                fields.get("asset_type", product.asset_type),
                exclude_product_id=product.product_id,
            ):
                raise HTTPException(400, "An asset with this ticker already exists")
            collision = await registry.find_symbol_collision(
                db, new_ticker, effective_broker_id
            )
            if collision is not None and collision[1].product_id != product.product_id:
                raise HTTPException(400, "An asset with this ticker already exists")

    if "broker_id" in fields and fields["broker_id"] != product.broker_id:
        symbol_count = int(
            (
                await db.execute(
                    select(func.count(AssetSymbol.symbol_id)).where(
                        AssetSymbol.product_id == product.product_id
                    )
                )
            ).scalar()
            or 0
        )
        if symbol_count:
            raise HTTPException(
                400,
                f"Cannot change broker_id for product {product.ticker} "
                f"(product_id={product.product_id}) while {symbol_count} "
                "symbols are attached",
            )
        if await _identity_exists(
            db,
            new_ticker,
            fields["broker_id"],
            fields.get("asset_type", product.asset_type),
            exclude_product_id=product.product_id,
        ):
            raise HTTPException(400, "An asset with this ticker already exists")

    if "asset_type" in fields and fields["asset_type"] != product.asset_type:
        if await _identity_exists(
            db,
            new_ticker,
            fields.get("broker_id", product.broker_id),
            fields["asset_type"],
            exclude_product_id=product.product_id,
        ):
            raise HTTPException(400, "An asset with this ticker already exists")

    if new_ticker != old_ticker:
        if old_ticker is not None and new_ticker is not None:
            # Only a real key-to-key rename rewrites order/ledger references.
            # Blanking the underlying must never null an order's symbol, and
            # assigning one must never claim rows whose symbol was NULL.
            await registry.rename_product_references(
                db, old_ticker, new_ticker, product
            )
        product.ticker = new_ticker
        if not product.name or product.name == old_ticker:
            product.name = new_ticker

    for field, value in fields.items():
        setattr(product, field, value)
    product.updated_at = datetime.utcnow()

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(400, "An asset with this ticker already exists")
    await db.refresh(product)
    return await registry.product_payload(db, product)


@router.delete("/products/{product_id}", status_code=204, tags=["assets"])
async def delete_product(product_id: int, db: AsyncSession = Depends(get_db)):
    product = await _product_or_404(db, product_id)
    if registry.is_default_product(product):
        raise HTTPException(400, "The default product is not editable")
    symbols = (
        await db.execute(
            select(AssetSymbol).where(AssetSymbol.product_id == product.product_id)
        )
    ).scalars().all()
    source = registry.quote_source(product)
    for symbol in symbols:
        sync_symbol = symbol.sync_symbol
        await db.delete(symbol)
        await db.flush()
        await registry.delete_quote_if_unreferenced(db, source, sync_symbol)
    await db.delete(product)
    await db.commit()


# ---------------------------------------------------------------------------
# Symbols and quotes
# ---------------------------------------------------------------------------

@router.get("/symbols", tags=["assets"])
async def list_symbols(
    product_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    query = select(AssetSymbol).order_by(AssetSymbol.symbol_id)
    if product_id is not None:
        query = query.where(AssetSymbol.product_id == product_id)
    symbols = (await db.execute(query)).scalars().all()
    payloads = []
    products: dict[int, AssetProduct] = {}
    for symbol in symbols:
        product = products.get(symbol.product_id)
        if product is None:
            product = await db.get(AssetProduct, symbol.product_id)
            if product is None:
                continue
            products[symbol.product_id] = product
        payloads.append(await registry.symbol_payload(db, symbol, product))
    return payloads


@router.post("/products/{product_id}/symbols", status_code=201, tags=["assets"])
async def create_symbol(
    product_id: int, data: SymbolCreate, db: AsyncSession = Depends(get_db)
):
    product = await _product_or_404(db, product_id)
    # Any identity may own symbols, including the default identity: its symbols
    # deliberately carry no broker-scoped spec, so Active Trading orders for
    # them stay blocked by the order guard while mapped portfolios still work.
    sync_symbol = (data.sync_symbol or "").strip()
    if not sync_symbol:
        raise HTTPException(400, "sync_symbol is required")
    _validate_symbol_values(
        data.multiplier_override,
        data.margin_rate_override,
        data.margin_per_contract,
    )
    stored_price_symbol = (
        data.price_symbol.strip()
        if isinstance(data.price_symbol, str) and data.price_symbol.strip()
        else None
    )
    collision = await registry.find_symbol_collision(
        db, stored_price_symbol, product.broker_id
    )
    if collision is not None:
        raise HTTPException(
            400,
            await registry.symbol_collision_detail(
                db, collision, registry.normalise_symbol(stored_price_symbol)
            ),
        )
    contract_kind = _validate_contract_kind(product, data.contract_kind)
    await registry.assert_option_identity_available(
        db,
        product,
        contract_kind=contract_kind,
        price_symbol=stored_price_symbol,
        option_type=data.option_type,
        expiry_date=data.expiry_date,
        strike_price=data.strike_price,
    )
    symbol = AssetSymbol(
        product_id=product.product_id,
        broker_id=product.broker_id,
        price_symbol=stored_price_symbol,
        sync_symbol=sync_symbol,
        contract_kind=contract_kind,
        option_type=data.option_type,
        expiry_date=data.expiry_date,
        strike_price=data.strike_price,
        # multiplier_override / margin_rate_override / margin_per_contract are
        # rejected above: they belong to the identity, not the contract.
    )
    db.add(symbol)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            400, "Symbol already exists"
        )
    await db.refresh(symbol)
    return await registry.symbol_payload(db, symbol, product)


@router.put("/symbols/{symbol_id}", tags=["assets"])
async def update_symbol(
    symbol_id: int, data: SymbolUpdate, db: AsyncSession = Depends(get_db)
):
    symbol, product = await _symbol_or_404(db, symbol_id)
    fields = data.model_dump(exclude_unset=True)
    _validate_symbol_values(
        fields.get("multiplier_override"),
        fields.get("margin_rate_override"),
        fields.get("margin_per_contract"),
    )
    if "sync_symbol" in fields:
        sync_symbol = (fields["sync_symbol"] or "").strip()
        if not sync_symbol:
            raise HTTPException(400, "sync_symbol is required")
        fields["sync_symbol"] = sync_symbol

    # A contract may change its owning identity: multiplier, margin_rate and
    # margin_mode are identity-owned, so the move is what re-bases them.
    # An omitted (or explicit null) product_id never moves the symbol.
    target_product = product
    requested_product_id = fields.pop("product_id", None)
    moving = (
        requested_product_id is not None
        and requested_product_id != symbol.product_id
    )
    if moving:
        target_product = await _product_or_404(db, requested_product_id)

    new_price_symbol = symbol.price_symbol
    price_symbol_supplied = "price_symbol" in fields
    if price_symbol_supplied:
        raw = fields.pop("price_symbol")
        new_price_symbol = raw.strip() if isinstance(raw, str) and raw.strip() else None
    if price_symbol_supplied or moving:
        collision = await registry.find_symbol_collision(
            db,
            new_price_symbol,
            target_product.broker_id,
            exclude_symbol_id=symbol.symbol_id,
        )
        if collision is not None:
            raise HTTPException(
                400,
                await registry.symbol_collision_detail(
                    db, collision, registry.normalise_symbol(new_price_symbol)
                ),
            )

    # Contract type and span margin are identity-owned: the type is derived
    # from the target product (a supplied value must match it) and a supplied
    # span value is rejected by _validate_symbol_values above.
    contract_kind = _validate_contract_kind(
        target_product, fields.get("contract_kind")
    )
    await registry.assert_option_identity_available(
        db,
        target_product,
        contract_kind=contract_kind,
        price_symbol=new_price_symbol,
        option_type=fields.get("option_type", symbol.option_type),
        expiry_date=fields.get("expiry_date", symbol.expiry_date),
        strike_price=fields.get("strike_price", symbol.strike_price),
        exclude_symbol_id=symbol.symbol_id,
    )

    if price_symbol_supplied:
        symbol.price_symbol = new_price_symbol
    for field in (
        "sync_symbol",
        "option_type",
        "expiry_date",
        "strike_price",
        "multiplier_override",
        "margin_rate_override",
    ):
        if field in fields:
            setattr(symbol, field, fields[field])
    symbol.contract_kind = contract_kind
    symbol.product_id = target_product.product_id
    symbol.broker_id = target_product.broker_id
    symbol.updated_at = datetime.utcnow()
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(400, "Symbol already exists")
    await db.refresh(symbol)
    return await registry.symbol_payload(db, symbol, target_product)


@router.delete("/symbols/{symbol_id}", status_code=204, tags=["assets"])
async def delete_symbol(symbol_id: int, db: AsyncSession = Depends(get_db)):
    symbol, product = await _symbol_or_404(db, symbol_id)
    source = registry.quote_source(product)
    sync_symbol = symbol.sync_symbol
    await db.delete(symbol)
    await db.flush()
    await registry.delete_quote_if_unreferenced(db, source, sync_symbol)
    await db.commit()


@router.put("/symbols/{symbol_id}/quote", tags=["assets"])
async def update_symbol_quote(
    symbol_id: int, data: QuoteUpdate, db: AsyncSession = Depends(get_db)
):
    symbol, product = await _symbol_or_404(db, symbol_id)
    source = registry.quote_source(product)
    quote = await registry.quote_for(db, product, symbol)
    fields = data.model_dump(exclude_unset=True)
    if quote is None:
        await registry.upsert_quote(
            db, source, symbol.sync_symbol, fields.get("price"), fields.get("change_24h")
        )
    else:
        if "price" in fields:
            quote.price = fields["price"]
        if "change_24h" in fields:
            quote.change_24h = fields["change_24h"]
        quote.updated_at = datetime.utcnow()
    await reprice_holdings_for_symbols(db, [(source, symbol.sync_symbol)])
    await db.commit()
    await db.refresh(symbol)
    return await registry.symbol_payload(db, symbol, product)


@router.post("/symbols/{symbol_id}/update-price", tags=["assets"])
async def update_symbol_price(symbol_id: int, db: AsyncSession = Depends(get_db)):
    symbol, product = await _symbol_or_404(db, symbol_id)
    try:
        await registry.refresh_symbol_quote(db, symbol, product)
    except Exception as exc:  # provider error is reported, never swallowed
        await db.rollback()
        raise HTTPException(502, f"Failed to fetch price: {exc}")
    await reprice_holdings_for_symbols(
        db, [(registry.quote_source(product), symbol.sync_symbol)]
    )
    await db.commit()
    await db.refresh(symbol)
    return await registry.symbol_payload(db, symbol, product)


@router.post("/symbols/batch-update-prices", tags=["assets"])
async def batch_update_prices(db: AsyncSession = Depends(get_db)):
    rows = (
        await db.execute(
            select(AssetSymbol, AssetProduct)
            .join(AssetProduct, AssetProduct.product_id == AssetSymbol.product_id)
            .where(
                func.coalesce(
                    func.nullif(func.trim(AssetProduct.source), ""), "-"
                ).in_(registry.PRICE_SOURCES)
            )
            .order_by(AssetSymbol.symbol_id)
        )
    ).all()

    by_key: dict[tuple[str, str], dict[str, Any]] = {}
    for symbol, product in rows:
        source = registry.quote_source(product)
        key = (source, symbol.sync_symbol)
        entry = by_key.setdefault(key, {"symbols": [], "price_symbols": set()})
        entry["symbols"].append((symbol, product))
        if symbol.price_symbol:
            entry["price_symbols"].add(symbol.price_symbol)

    updated = 0
    tickers: set[str] = set()
    written_pairs: list[tuple[str, str]] = []
    for (source, sync_symbol), entry in by_key.items():
        try:
            price, change = registry._fetch_quote(source, sync_symbol)
        except Exception:
            continue
        await registry.upsert_quote(db, source, sync_symbol, price, change)
        written_pairs.append((source, sync_symbol))
        updated += 1
        tickers.update(str(value) for value in entry["price_symbols"])
    await reprice_holdings_for_symbols(db, written_pairs)
    await db.commit()
    return {"updated": updated, "tickers": sorted(tickers)}


# ---------------------------------------------------------------------------
# Sync proposal / apply
# ---------------------------------------------------------------------------

class _ProposalPair:
    """One ``(broker, symbol)`` pair plus the order asset types behind it."""

    __slots__ = ("broker_required", "order_asset_types")

    def __init__(self) -> None:
        self.broker_required = False
        self.order_asset_types: set[str] = set()

    def add(self, asset_type: Any, *, broker_required: bool = False) -> None:
        self.broker_required = self.broker_required or broker_required
        text_value = str(asset_type).strip() if asset_type is not None else ""
        if text_value:
            self.order_asset_types.add(text_value)


async def _collect_proposal_pairs(
    db: AsyncSession,
) -> dict[tuple[Optional[int], str], _ProposalPair]:
    """``(broker_id, normalized symbol) -> _ProposalPair``.

    Includes main, owned-custom and mapped active orders plus Managed Fund
    holdings and open orders. A fund source records no contract type, so it
    contributes to the pair but never to ``order_asset_types``.
    ``broker_required`` marks a brokerless Active Trading portfolio, which
    cannot receive a registry symbol; fund pairs never set it.
    ``order_asset_types`` is the distinct order asset type recorded on the
    orders behind the pair — a hint for the user, never a default.
    """
    pairs: dict[tuple[Optional[int], str], _ProposalPair] = {}

    def record(
        broker_id: Optional[int],
        symbol: Optional[str],
        asset_type: Any,
        *,
        broker_required: bool,
    ) -> None:
        if symbol is None:
            return
        key = (broker_id, symbol)
        pairs.setdefault(key, _ProposalPair()).add(
            asset_type, broker_required=broker_required
        )

    main_rows = (
        await db.execute(
            select(
                ActiveOrder.asset_type,
                ActiveOrder.contract_type,
                Portfolio.broker_id,
                Portfolio.port_type,
            )
            .join(Portfolio, Portfolio.portfolio_id == ActiveOrder.portfolio_id)
            .where(Portfolio.is_custom.is_(False))
        )
    ).all()
    for order_symbol, asset_type, broker_id, port_type in main_rows:
        record(
            broker_id,
            registry.normalise_symbol(order_symbol),
            asset_type,
            broker_required=port_type == "Active Trading" and broker_id is None,
        )

    portfolios = (
        await db.execute(select(Portfolio).where(Portfolio.is_custom.is_(True)))
    ).scalars().all()
    for portfolio in portfolios:
        connection = (
            await db.execute(
                select(CustomPortfolioConnection).where(
                    CustomPortfolioConnection.portfolio_id
                    == portfolio.portfolio_id
                )
            )
        ).scalar_one_or_none()
        if connection is None:
            continue
        required = (
            portfolio.port_type == "Active Trading" and portfolio.broker_id is None
        )
        try:
            if connection.mapping_config:
                engine = await get_or_create_custom_engine(connection)
                orders = await fetch_mapped_orders(engine, connection.mapping_config)
                for order in orders:
                    record(
                        portfolio.broker_id,
                        registry.normalise_symbol(order.get("asset_type")),
                        order.get("contract_type"),
                        broker_required=required,
                    )
            else:
                session = await get_custom_session(connection)
                try:
                    custom_symbols = (
                        await session.execute(
                            select(
                                CustomActiveOrder.asset_type,
                                CustomActiveOrder.contract_type,
                            ).distinct()
                        )
                    ).all()
                    for order_symbol, asset_type in custom_symbols:
                        record(
                            portfolio.broker_id,
                            registry.normalise_symbol(order_symbol),
                            asset_type,
                            broker_required=required,
                        )
                finally:
                    await session.close()
        except Exception:
            logger.warning(
                "Skipping custom portfolio %s while building the sync proposal",
                portfolio.portfolio_id,
                exc_info=True,
            )
            continue

    # Managed Fund sources: holdings and still-open orders. They merge into the
    # same (broker, symbol) pairs as every other source; a fund row carries no
    # contract type, so it never invents an ``order_asset_types`` hint.
    fund_holdings = (
        await db.execute(
            select(ManagedFundHolding.asset, Portfolio.broker_id).join(
                Portfolio,
                Portfolio.portfolio_id == ManagedFundHolding.portfolio_id,
            )
        )
    ).all()
    for holding_asset, broker_id in fund_holdings:
        record(
            broker_id,
            registry.normalise_symbol(holding_asset),
            None,
            broker_required=False,
        )
    fund_orders = (
        await db.execute(
            select(ManagedFundOrder.asset, Portfolio.broker_id)
            .join(Portfolio, Portfolio.portfolio_id == ManagedFundOrder.portfolio_id)
            .where(
                func.lower(ManagedFundOrder.status).notin_(("done", "cancelled"))
            )
        )
    ).all()
    for order_asset, broker_id in fund_orders:
        record(
            broker_id,
            registry.normalise_symbol(order_asset),
            None,
            broker_required=False,
        )
    return pairs


async def _proposal_items(db: AsyncSession) -> list[dict]:
    pairs = await _collect_proposal_pairs(db)
    codes = await registry.broker_codes(db)
    items = []
    for broker_id, symbol in sorted(
        pairs, key=lambda pair: (pair[0] is None, pair[0] or 0, pair[1])
    ):
        products = (
            await db.execute(
                select(AssetProduct)
                .where(
                    or_(
                        AssetProduct.ticker.isnot(None),
                        AssetProduct.broker_id.isnot(None),
                        AssetProduct.asset_type.isnot(None),
                    ),
                    AssetProduct.broker_id.is_(None)
                    if broker_id is None
                    else AssetProduct.broker_id == broker_id,
                )
                .order_by(
                    func.upper(AssetProduct.ticker),
                    AssetProduct.product_id,
                )
            )
        ).scalars().all()
        symbol_counts: dict[int, int] = {}
        resolved = False
        product_ids = [product.product_id for product in products]
        if broker_id is None:
            # A brokerless pair can already be attached to the default identity,
            # which the product list above excludes on purpose.
            default_product = await _default_identity_product(db)
            if default_product is not None:
                product_ids.append(default_product.product_id)
        if product_ids:
            symbol_rows = (
                await db.execute(
                    select(AssetSymbol.product_id, AssetSymbol.price_symbol).where(
                        AssetSymbol.product_id.in_(product_ids)
                    )
                )
            ).all()
            for product_id, price_symbol in symbol_rows:
                symbol_counts[product_id] = symbol_counts.get(product_id, 0) + 1
                if registry.normalise_symbol(price_symbol) == symbol:
                    resolved = True
        choices = []
        for product in products:
            choices.append(
                {
                    "product_id": product.product_id,
                    "ticker": product.ticker,
                    "asset_type": product.asset_type,
                    "multiplier": float(product.multiplier or 0),
                    "margin_rate": float(product.margin_rate or 0),
                    "margin_mode": product.margin_mode,
                    "symbol_count": symbol_counts.get(product.product_id, 0),
                }
            )
        items.append(
            {
                "symbol": symbol,
                "broker_id": broker_id,
                "broker_code": codes.get(broker_id) if broker_id is not None else None,
                "broker_required": pairs[(broker_id, symbol)].broker_required,
                "resolved": resolved,
                "products": choices,
                "order_asset_types": sorted(
                    pairs[(broker_id, symbol)].order_asset_types
                ),
                "create": {"symbol": symbol},
            }
        )
    return items


@router.get("/proposal", tags=["assets"])
@router.get("/sync-proposal", include_in_schema=False)
async def sync_proposal(db: AsyncSession = Depends(get_db)):
    return {"items": await _proposal_items(db)}


CREATE_SOURCES = ("yfinance", "tfex", "manual")
CREATE_ASSET_TYPES = ("stock", "future", "option", "crypto", "mutual_fund")


def _validated_create_fields(
    choice: SyncChoice, symbol: str
) -> tuple[str, Optional[str], str]:
    """Validate the explicit create fields; ``(source, type, sync_key)``.

    The dashboard never infers the provider: the user supplies the source, the
    provider symbol and (optionally) the asset type. ``manual`` keeps the
    dashboard symbol as its sync key and is never fetched. An absent asset type
    means the identity has no type — the default identity part, not a guess.
    """
    source = (choice.create_source or "").strip().lower()
    if source not in CREATE_SOURCES:
        raise HTTPException(
            400, "Create needs a price source: yfinance, tfex or manual"
        )
    asset_type = (choice.create_asset_type or "").strip().lower()
    if asset_type and asset_type not in CREATE_ASSET_TYPES:
        raise HTTPException(
            400,
            "Create needs an asset type: stock, future, option, crypto or "
            "mutual_fund",
        )
    sync_symbol = (choice.create_sync_symbol or "").strip()
    if source != "manual" and not sync_symbol:
        raise HTTPException(400, "Create needs the provider symbol (sync_symbol)")
    if source == "manual" and not sync_symbol:
        sync_symbol = symbol
    return source, asset_type or None, sync_symbol


@router.post("/apply", tags=["assets"])
@router.post("/sync-apply", include_in_schema=False)
async def sync_apply(data: SyncApplyRequest, db: AsyncSession = Depends(get_db)):
    items = await _proposal_items(db)
    proposed_symbols = {item["symbol"] for item in items}
    codes = await registry.broker_codes(db)

    created = 0
    try:
        for choice in data.choices:
            symbol = registry.normalise_symbol(choice.symbol)
            # The chosen broker is the sync-time decision; the proposal only
            # proves the order symbol exists somewhere. Every identity lookup,
            # product validation and owner collision below uses this choice.
            broker_id = choice.broker_id
            if symbol is None or symbol not in proposed_symbols:
                raise HTTPException(
                    400, f"Symbol {choice.symbol} was not in the proposal"
                )
            if broker_id is not None and broker_id not in codes:
                raise HTTPException(400, f"Broker {broker_id} not found")
            has_product = choice.product_id is not None
            wants_create = choice.create_product is True
            if has_product == wants_create:
                raise HTTPException(
                    400, "Provide exactly one of product_id or create_product=true"
                )

            # No inference: assigning an existing product creates its symbol
            # with the dashboard key as the sync key and fetches nothing.
            source: Optional[str] = None
            asset_type: Optional[str] = None
            sync_symbol = symbol

            if has_product:
                product = await db.get(AssetProduct, choice.product_id)
                if product is None:
                    raise HTTPException(404, "Product not found")
                if registry.is_default_product(product):
                    raise HTTPException(400, "The default product is not editable")
                if product.broker_id != broker_id:
                    broker_code_value = (
                        codes.get(broker_id) if broker_id is not None else "Unassigned"
                    )
                    raise HTTPException(
                        400,
                        f"Product {product.ticker} (product_id={product.product_id}) "
                        f"is not in broker {broker_code_value}",
                    )
            else:
                underlying = registry.normalise_ticker(choice.create_underlying)
                source, asset_type, sync_symbol = _validated_create_fields(
                    choice, symbol
                )
                if underlying is None and broker_id is None and asset_type is None:
                    # The reserved all-NULL identity is the seeded default
                    # product. Reuse it (or recreate the migration's shape) and
                    # attach the symbol there instead of erroring.
                    product = await _default_identity_product(db)
                    if product is None:
                        product = AssetProduct(
                            ticker=None,
                            broker_id=None,
                            asset_type=None,
                            multiplier=1,
                            margin_rate=0,
                            margin_mode="notional",
                            source="-",
                        )
                        db.add(product)
                        await db.flush()
                else:
                    if await _identity_exists(
                        db, underlying, broker_id, asset_type
                    ):
                        raise HTTPException(
                            400, "An asset with this ticker already exists"
                        )
                    product = AssetProduct(
                        ticker=underlying,
                        broker_id=broker_id,
                        asset_type=asset_type,
                        multiplier=1,
                        margin_rate=0,
                        margin_mode="notional",
                        source=source,
                    )
                    db.add(product)
                    await db.flush()

            owner = await registry.resolve_symbol_owner(db, symbol, broker_id)
            if owner is not None and owner[1].product_id != product.product_id:
                raise HTTPException(
                    400,
                    await registry.symbol_collision_detail(db, owner, symbol),
                )
            if owner is not None:
                # Same owner: explicit choice is idempotent.
                continue
            if owner is None and broker_id is None:
                # Brokerless symbols (the default identity included) have no
                # owner resolution, so check the brokerless scope directly.
                collision = await registry.find_symbol_collision(db, symbol, None)
                if collision is not None:
                    if collision[1].product_id == product.product_id:
                        continue
                    raise HTTPException(
                        400,
                        await registry.symbol_collision_detail(db, collision, symbol),
                    )

            if has_product:
                # An existing product supplies the symbol's contract kind. A
                # sync row has no option terms, and a missing asset type is a
                # question only All Assets can answer, so neither is guessed.
                kind = (product.asset_type or "").strip().lower()
                if kind == "option":
                    raise HTTPException(
                        400,
                        "Add the option contract in All-assets — a sync row has "
                        "no expiry, strike or type",
                    )
                if kind not in ("stock", "future", "crypto", "mutual_fund"):
                    raise HTTPException(
                        400,
                        f"Set the asset type of product {product.ticker} "
                        "in All-assets before syncing",
                    )
                contract_kind = kind
            else:
                contract_kind = (
                    "option" if asset_type == "option" else (asset_type or "future")
                )
            new_symbol = AssetSymbol(
                product_id=product.product_id,
                broker_id=product.broker_id,
                price_symbol=symbol,
                sync_symbol=sync_symbol,
                contract_kind=contract_kind,
            )
            db.add(new_symbol)
            await db.flush()
            created += 1

            identity_source = registry.quote_source(product)
            if identity_source in registry.PRICE_SOURCES:
                try:
                    price, change = registry._fetch_quote(
                        identity_source, sync_symbol
                    )
                    await registry.upsert_quote(
                        db, identity_source, sync_symbol, price, change
                    )
                except Exception:
                    # Best effort: keep existing/null quote values.
                    pass
        await db.commit()
    except HTTPException:
        await db.rollback()
        raise
    return {"created": created, "choices": len(data.choices)}
