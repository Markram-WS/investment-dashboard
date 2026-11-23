from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import logging

from app.database import (
    get_db, get_custom_session, get_or_create_custom_engine, resolve_portfolio_db,
)
from app.models import (
    WhitelistAssets, AssetGroup, ActiveOrder, Broker,
    CustomPortfolioConnection, Portfolio,
)
from app.custom_models import CustomActiveOrder, CustomWhitelistAssets
from app.custom_mapping import (
    fetch_mapped_orders, is_mapped_portfolio, raise_if_mapped_readonly,
)
from app.managed_fund_models import ManagedFundHolding
from app.services import tfex_service
from app.services.yfinance_service import fetch_price

logger = logging.getLogger(__name__)

PRICE_SOURCES = ('yfinance', 'tfex')

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
    name: Optional[str] = None
    price_symbol: Optional[str] = None
    asset_type: Optional[str] = None
    source: Optional[str] = None
    group_id: Optional[int] = None
    price: Optional[float] = None
    change_24h: Optional[float] = None
    multiplier: Optional[float] = None
    margin_rate: Optional[float] = None

router = APIRouter()


async def _broker_codes(db: AsyncSession) -> dict:
    result = await db.execute(select(Broker.id, Broker.code))
    return {row[0]: row[1] for row in result.all()}


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


async def _ensure_default_group(db: AsyncSession):
    result = await db.execute(select(AssetGroup).where(AssetGroup.name == "Ungrouped"))
    group = result.scalars().first()
    if not group:
        group = AssetGroup(name="Ungrouped", is_default=True)
        db.add(group)
        await db.commit()
        await db.refresh(group)
    return group


def _normalise_ticker(value) -> str | None:
    """Asset ticker in the dashboard's stored form, or None when blank."""
    if not isinstance(value, str):
        return None
    ticker = value.strip().upper()
    return ticker or None


def _normalise_price_symbol(value, fallback: str | None = None) -> str | None:
    """Provider symbol for the price feed, or ``fallback`` when blank.

    Unlike the dashboard ticker it is only stripped, never uppercased: Yahoo
    Finance symbols are case-sensitive (``PTT.BK``).
    """
    if isinstance(value, str) and value.strip():
        return value.strip()
    return fallback


def _fetch_source_price(asset) -> tuple[float, float]:
    """Fetch ``(price, change_24h)`` for an asset from its configured source.

    Manual assets are never fetched; callers only pass yfinance/tfex sources.
    """
    symbol = asset.price_symbol or asset.ticker
    if asset.source == 'tfex':
        return tfex_service.fetch_price(symbol)
    return fetch_price(symbol)


async def _collect_order_tickers(db: AsyncSession) -> tuple[set[str], set[str]]:
    """Order tickers across the main DB and every custom portfolio.

    Returns ``(tickers, mapped_tickers)``. Mapped portfolios are read through
    the foreign-schema adapter (never ``ensure_custom_tables`` on a foreign
    database); legacy custom portfolios use their own session. A portfolio
    whose external database is unreachable is skipped so one broken
    connection cannot block local asset sync.
    """
    tickers: set[str] = set()
    mapped_tickers: set[str] = set()

    result = await db.execute(select(ActiveOrder.asset_type).distinct())
    for row in result:
        ticker = _normalise_ticker(row[0])
        if ticker:
            tickers.add(ticker)

    portfolios_result = await db.execute(
        select(Portfolio).where(Portfolio.is_custom.is_(True))
    )
    for portfolio in portfolios_result.scalars().all():
        conn_result = await db.execute(
            select(CustomPortfolioConnection).where(
                CustomPortfolioConnection.portfolio_id == portfolio.portfolio_id
            )
        )
        connection = conn_result.scalar_one_or_none()
        if connection is None:
            continue
        try:
            if connection.mapping_config:
                engine = await get_or_create_custom_engine(connection)
                orders = await fetch_mapped_orders(engine, connection.mapping_config)
                portfolio_tickers = {_normalise_ticker(o.get("asset_type")) for o in orders}
                portfolio_tickers.discard(None)
                mapped_tickers.update(portfolio_tickers)
                tickers.update(portfolio_tickers)
            else:
                session = await get_custom_session(connection)
                try:
                    custom_result = await session.execute(
                        select(CustomActiveOrder.asset_type).distinct()
                    )
                    for row in custom_result:
                        ticker = _normalise_ticker(row[0])
                        if ticker:
                            tickers.add(ticker)
                finally:
                    await session.close()
        except Exception:
            logger.warning(
                "Skipping custom portfolio %s while collecting order tickers",
                portfolio.portfolio_id,
                exc_info=True,
            )

    return tickers, mapped_tickers

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
    try:
        ModelClass = CustomWhitelistAssets if is_custom else WhitelistAssets
        query = select(ModelClass)
        if group_id is not None:
            query = query.where(ModelClass.group_id == group_id)
        if asset_type:
            query = query.where(ModelClass.asset_type == asset_type)
        if source:
            query = query.where(ModelClass.source == source)
        query = query.order_by(ModelClass.ticker)
        result = await session.execute(query)
        assets = result.scalars().all()
        codes = {} if is_custom else await _broker_codes(db)
        return [_asset_payload(a, codes) for a in assets]
    finally:
        if is_custom:
            await session.close()

@router.post("", response_model=AssetResponse, status_code=201, tags=["assets"])
async def create_asset(
    data: AssetCreate,
    db: AsyncSession = Depends(get_db),
    portfolio_id: Optional[int] = None,
):
    await raise_if_mapped_readonly(db, portfolio_id)
    session, is_custom = await resolve_portfolio_db(db, portfolio_id)
    try:
        ModelClass = CustomWhitelistAssets if is_custom else WhitelistAssets
        if data.multiplier is not None and data.multiplier <= 0:
            raise HTTPException(400, "multiplier must be greater than 0")
        if data.margin_rate is not None and not (0 <= data.margin_rate <= 1):
            raise HTTPException(400, "margin_rate must be between 0 and 1")
        broker_id = data.broker_id or 1
        if is_custom:
            existing = await session.execute(
                select(ModelClass).where(ModelClass.ticker == data.ticker.upper())
            )
        else:
            existing = await session.execute(
                select(ModelClass).where(
                    ModelClass.ticker == data.ticker.upper(),
                    ModelClass.broker_id == broker_id,
                )
            )
        if existing.scalars().first():
            raise HTTPException(400, "Asset with this ticker already exists")
        asset = ModelClass(
            ticker=data.ticker.upper(),
            price_symbol=_normalise_price_symbol(data.price_symbol, data.ticker.upper()),
            asset_type=data.asset_type,
            name=data.name or data.ticker.upper(),
            source=data.source,
            group_id=data.group_id,
        )
        if not is_custom:
            asset.broker_id = broker_id
            asset.multiplier = data.multiplier if data.multiplier is not None else 1
            asset.margin_rate = data.margin_rate if data.margin_rate is not None else 0
        session.add(asset)
        await session.commit()
        await session.refresh(asset)
        codes = {} if is_custom else await _broker_codes(db)
        return _asset_payload(asset, codes)
    finally:
        if is_custom:
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
    try:
        ModelClass = CustomWhitelistAssets if is_custom else WhitelistAssets
        result = await session.execute(select(ModelClass).where(ModelClass.asset_id == asset_id))
        asset = result.scalars().first()
        if not asset:
            raise HTTPException(404, "Asset not found")
        if data.multiplier is not None and data.multiplier <= 0:
            raise HTTPException(400, "multiplier must be greater than 0")
        if data.margin_rate is not None and not (0 <= data.margin_rate <= 1):
            raise HTTPException(400, "margin_rate must be between 0 and 1")
        # Blank (or explicit null) clears the override: NULL means "use the ticker".
        if "price_symbol" in data.model_fields_set:
            asset.price_symbol = _normalise_price_symbol(data.price_symbol)
        for field in ("name", "asset_type", "source", "group_id", "price", "change_24h", "multiplier", "margin_rate"):
            val = getattr(data, field, None)
            if val is None:
                continue
            if field in ("multiplier", "margin_rate") and not hasattr(asset, field):
                continue
            setattr(asset, field, val)
        asset.updated_at = datetime.utcnow()
        await session.commit()
        await session.refresh(asset)
        codes = {} if is_custom else await _broker_codes(db)
        return _asset_payload(asset, codes)
    finally:
        if is_custom:
            await session.close()

@router.delete("/{asset_id}", status_code=204, tags=["assets"])
async def delete_asset(
    asset_id: int,
    db: AsyncSession = Depends(get_db),
    portfolio_id: Optional[int] = None,
):
    await raise_if_mapped_readonly(db, portfolio_id)
    session, is_custom = await resolve_portfolio_db(db, portfolio_id)
    try:
        ModelClass = CustomWhitelistAssets if is_custom else WhitelistAssets
        result = await session.execute(select(ModelClass).where(ModelClass.asset_id == asset_id))
        asset = result.scalars().first()
        if not asset:
            raise HTTPException(404, "Asset not found")
        await session.delete(asset)
        await session.commit()
    finally:
        if is_custom:
            await session.close()

@router.post("/sync-from-orders", response_model=List[AssetResponse], tags=["assets"])
async def sync_from_orders(db: AsyncSession = Depends(get_db)):
    tickers, mapped_tickers = await _collect_order_tickers(db)
    existing = await db.execute(select(WhitelistAssets.ticker))
    existing_tickers = {row[0].upper() for row in existing if row[0]}
    missing = tickers - existing_tickers
    if not missing:
        return []
    ung_group = await _ensure_default_group(db)
    new_assets = []
    for ticker in sorted(missing):
        asset = WhitelistAssets(
            ticker=ticker,
            price_symbol=ticker,
            asset_type='future' if ticker in mapped_tickers else 'stock',
            name=ticker,
            source='tfex' if ticker in mapped_tickers else 'yfinance',
            group_id=ung_group.id,
        )
        db.add(asset)
        new_assets.append(asset)
    await db.commit()
    for a in new_assets:
        await db.refresh(a)
        try:
            price, change = _fetch_source_price(a)
            a.price = price
            a.change_24h = change
        except Exception:
            pass
    await db.commit()
    for a in new_assets:
        await db.refresh(a)
    return new_assets

@router.post("/sync-from-all", response_model=List[AssetResponse], tags=["assets"])
async def sync_from_all(db: AsyncSession = Depends(get_db)):
    tickers, mapped_tickers = await _collect_order_tickers(db)

    # From Managed Fund holdings
    mf_hold_result = await db.execute(select(ManagedFundHolding.asset).distinct())
    for row in mf_hold_result:
        ticker = _normalise_ticker(row[0])
        if ticker:
            tickers.add(ticker)

    existing = await db.execute(select(WhitelistAssets.ticker))
    existing_tickers = {row[0].upper() for row in existing if row[0]}
    missing = tickers - existing_tickers

    if not missing:
        return []

    ung_group = await _ensure_default_group(db)
    new_assets = []
    for ticker in sorted(missing):
        asset = WhitelistAssets(
            ticker=ticker,
            price_symbol=ticker,
            asset_type='future' if ticker in mapped_tickers else 'crypto',
            name=ticker,
            source='tfex' if ticker in mapped_tickers else 'manual',
            group_id=ung_group.id,
        )
        db.add(asset)
        new_assets.append(asset)
    await db.commit()
    for a in new_assets:
        await db.refresh(a)
    return new_assets


@router.post("/{asset_id}/update-price", response_model=AssetResponse, tags=["assets"])
async def update_asset_price(asset_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(WhitelistAssets).where(WhitelistAssets.asset_id == asset_id))
    asset = result.scalars().first()
    if not asset:
        raise HTTPException(404, "Asset not found")
    if asset.source in PRICE_SOURCES:
        try:
            price, change = _fetch_source_price(asset)
            asset.price = price
            asset.change_24h = change
        except Exception as e:
            raise HTTPException(502, f"Failed to fetch price: {e}")
    asset.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(asset)
    return asset

@router.post("/batch-update-prices", tags=["assets"])
async def batch_update_prices(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(WhitelistAssets).where(WhitelistAssets.source.in_(PRICE_SOURCES))
    )
    assets = result.scalars().all()
    updated = []
    for asset in assets:
        try:
            price, change = _fetch_source_price(asset)
            asset.price = price
            asset.change_24h = change
            asset.updated_at = datetime.utcnow()
            updated.append(asset.ticker)
        except Exception:
            pass
    await db.commit()
    return {"updated": len(updated), "tickers": updated}
