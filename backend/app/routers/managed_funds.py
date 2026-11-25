from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import AssetProduct, AssetSymbol, Portfolio, PortfolioNavHistory
from app.managed_fund_models import ManagedFundHolding, ManagedFundOrder, ManagedFundOrderHistory, ManagedFundSetting
from app.services import asset_registry as registry
from pydantic import BaseModel
from typing import Iterable, Optional, Dict, Any, List
from decimal import Decimal
from datetime import datetime, date

router = APIRouter()


# ─── Pydantic Schemas ───

class MFSettingResponse(BaseModel):
    id: int
    portfolio_id: int
    target_ratio: Optional[Dict[str, Any]] = None
    global_profit_threshold: Optional[float] = 0
    total_invested: Optional[float] = 0
    last_rebalance_date: Optional[str] = None

class MFSettingUpdate(BaseModel):
    target_ratio: Optional[Dict[str, float]] = None
    global_profit_threshold: Optional[float] = None

class MFHoldingResponse(BaseModel):
    holding_id: int
    portfolio_id: int
    asset: str
    qty: float
    avg_entry_price: float
    current_price: float
    market_value: float
    unrealized_pl: float
    unrealized_pl_pct: float
    profit_threshold: float

class MFOrderResponse(BaseModel):
    order_id: int
    portfolio_id: int
    asset: str
    side: str
    qty: float
    price: Optional[float] = None
    status: str
    order_type: str
    notes: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class MFOrderCreate(BaseModel):
    asset: str
    side: str
    qty: float
    price: Optional[float] = None
    order_type: Optional[str] = 'manual'
    notes: Optional[str] = None

class MFOrderUpdate(BaseModel):
    asset: Optional[str] = None
    side: Optional[str] = None
    qty: Optional[float] = None
    price: Optional[float] = None
    notes: Optional[str] = None

class MFSellRequest(BaseModel):
    qty: float
    price: Optional[float] = None

class MFOrderStatusUpdate(BaseModel):
    status: str

class MFHistoryResponse(BaseModel):
    history_id: int
    portfolio_id: int
    asset: str
    side: str
    qty: float
    price: Optional[float] = None
    status: str
    order_type: str
    notes: Optional[str] = None
    executed_at: Optional[str] = None

class MFRebalanceRecommendation(BaseModel):
    symbol: str
    side: str
    qty: float
    estimated_price: float
    reason: str
    current_allocation: float
    target_allocation: float
    drift: float

class MFRebalanceResponse(BaseModel):
    portfolio_id: int
    portfolio_name: str
    current_nav: float
    target_allocations: Dict[str, float]
    current_allocations: Dict[str, float]
    recommendations: List[MFRebalanceRecommendation]
    total_drift: float

class MFAlertItem(BaseModel):
    asset: str
    qty: float
    unrealized_pl_pct: float
    threshold: float
    message: str

class MFAlertsResponse(BaseModel):
    alerts: List[MFAlertItem]


# ─── Helper ───

def _row_to_dict(row, columns: list[str]) -> dict:
    return {c: getattr(row, c) for c in columns}


# ─── Settings ───

@router.get("/{portfolio_id}/settings", response_model=MFSettingResponse)
async def get_settings(portfolio_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ManagedFundSetting).where(ManagedFundSetting.portfolio_id == portfolio_id)
    )
    setting = result.scalar_one_or_none()
    if not setting:
        port_result = await db.execute(
            select(Portfolio).where(Portfolio.portfolio_id == portfolio_id)
        )
        port = port_result.scalar_one_or_none()
        setting = ManagedFundSetting(
            portfolio_id=portfolio_id,
            target_ratio=port.target_ratio if port else None,
        )
        db.add(setting)
        await db.commit()
        await db.refresh(setting)
    elif setting.target_ratio is None:
        port_result = await db.execute(
            select(Portfolio).where(Portfolio.portfolio_id == portfolio_id)
        )
        port = port_result.scalar_one_or_none()
        if port and port.target_ratio:
            setting.target_ratio = port.target_ratio
            await db.commit()
            await db.refresh(setting)

    target_ratio = setting.target_ratio
    if target_ratio:
        vals = [float(v) for v in target_ratio.values() if v is not None]
        if vals and max(vals) <= 1.0:
            target_ratio = {k: float(v) * 100 for k, v in target_ratio.items() if v is not None}

    return MFSettingResponse(
        id=setting.id,
        portfolio_id=setting.portfolio_id,
        target_ratio=target_ratio,
        global_profit_threshold=float(setting.global_profit_threshold or 0),
        total_invested=float(setting.total_invested or 0),
        last_rebalance_date=setting.last_rebalance_date.isoformat() if setting.last_rebalance_date else None,
    )


@router.put("/{portfolio_id}/settings", response_model=MFSettingResponse)
async def update_settings(portfolio_id: int, body: MFSettingUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ManagedFundSetting).where(ManagedFundSetting.portfolio_id == portfolio_id)
    )
    setting = result.scalar_one_or_none()
    if not setting:
        setting = ManagedFundSetting(portfolio_id=portfolio_id)
        db.add(setting)
    if body.target_ratio is not None:
        setting.target_ratio = body.target_ratio
    if body.global_profit_threshold is not None:
        setting.global_profit_threshold = Decimal(str(body.global_profit_threshold))
    await db.commit()
    await db.refresh(setting)
    return await get_settings(portfolio_id, db)


# ─── Holdings ───

@router.get("/{portfolio_id}/holdings", response_model=List[MFHoldingResponse])
async def list_holdings(portfolio_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ManagedFundHolding).where(ManagedFundHolding.portfolio_id == portfolio_id)
    )
    holdings = result.scalars().all()
    return [
        MFHoldingResponse(
            holding_id=h.holding_id,
            portfolio_id=h.portfolio_id,
            asset=h.asset,
            qty=float(h.qty or 0),
            avg_entry_price=float(h.avg_entry_price or 0),
            current_price=float(h.current_price or 0),
            market_value=float(h.market_value or 0),
            unrealized_pl=float(h.unrealized_pl or 0),
            unrealized_pl_pct=float(h.unrealized_pl_pct or 0),
            profit_threshold=float(h.profit_threshold or 0),
        )
        for h in holdings
    ]


@router.post("/{portfolio_id}/holdings", response_model=MFHoldingResponse, status_code=201)
async def create_holding(portfolio_id: int, body: MFOrderCreate, db: AsyncSession = Depends(get_db)):
    holding = ManagedFundHolding(
        portfolio_id=portfolio_id,
        asset=body.asset.upper(),
        qty=Decimal(str(body.qty)),
        avg_entry_price=Decimal(str(body.price or 0)),
        current_price=Decimal(str(body.price or 0)),
        market_value=Decimal(str(body.qty * (body.price or 0))),
    )
    db.add(holding)
    await db.commit()
    await db.refresh(holding)
    return MFHoldingResponse(
        holding_id=holding.holding_id,
        portfolio_id=holding.portfolio_id,
        asset=holding.asset,
        qty=float(holding.qty or 0),
        avg_entry_price=float(holding.avg_entry_price or 0),
        current_price=float(holding.current_price or 0),
        market_value=float(holding.market_value or 0),
        unrealized_pl=float(holding.unrealized_pl or 0),
        unrealized_pl_pct=float(holding.unrealized_pl_pct or 0),
        profit_threshold=float(holding.profit_threshold or 0),
    )


@router.put("/{portfolio_id}/holdings/{holding_id}", response_model=MFHoldingResponse)
async def update_holding(portfolio_id: int, holding_id: int, body: MFOrderUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ManagedFundHolding).where(
            ManagedFundHolding.holding_id == holding_id,
            ManagedFundHolding.portfolio_id == portfolio_id,
        )
    )
    holding = result.scalar_one_or_none()
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
    if body.qty is not None:
        holding.qty = Decimal(str(body.qty))
    if body.price is not None:
        holding.avg_entry_price = Decimal(str(body.price))
    holding.market_value = holding.qty * holding.current_price
    holding.unrealized_pl = (holding.current_price - holding.avg_entry_price) * holding.qty
    if holding.avg_entry_price and holding.avg_entry_price > 0:
        holding.unrealized_pl_pct = Decimal(str(
            round(((float(holding.current_price) - float(holding.avg_entry_price)) / float(holding.avg_entry_price)) * 100, 4)
        ))
    await db.commit()
    await db.refresh(holding)
    return MFHoldingResponse(
        holding_id=holding.holding_id,
        portfolio_id=holding.portfolio_id,
        asset=holding.asset,
        qty=float(holding.qty or 0),
        avg_entry_price=float(holding.avg_entry_price or 0),
        current_price=float(holding.current_price or 0),
        market_value=float(holding.market_value or 0),
        unrealized_pl=float(holding.unrealized_pl or 0),
        unrealized_pl_pct=float(holding.unrealized_pl_pct or 0),
        profit_threshold=float(holding.profit_threshold or 0),
    )


@router.post("/{portfolio_id}/holdings/{holding_id}/sell", response_model=MFOrderResponse, status_code=201)
async def sell_holding(portfolio_id: int, holding_id: int, body: MFSellRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ManagedFundHolding).where(
            ManagedFundHolding.holding_id == holding_id,
            ManagedFundHolding.portfolio_id == portfolio_id,
        )
    )
    holding = result.scalar_one_or_none()
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
    sell_qty = float(body.qty) if body.qty else float(holding.qty)
    order = ManagedFundOrder(
        portfolio_id=portfolio_id,
        asset=holding.asset,
        side="Sell",
        qty=Decimal(str(sell_qty)),
        price=Decimal(str(body.price or 0)),
        order_type="sell_all",
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)
    return MFOrderResponse(
        order_id=order.order_id,
        portfolio_id=order.portfolio_id,
        asset=order.asset,
        side=order.side,
        qty=float(order.qty or 0),
        price=float(order.price or 0) if order.price else None,
        status=order.status,
        order_type=order.order_type,
        notes=order.notes,
        created_at=order.created_at.isoformat() if order.created_at else None,
        updated_at=order.updated_at.isoformat() if order.updated_at else None,
    )


# ─── Orders ───

@router.get("/{portfolio_id}/orders", response_model=List[MFOrderResponse])
async def list_orders(portfolio_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ManagedFundOrder)
        .where(ManagedFundOrder.portfolio_id == portfolio_id)
        .order_by(ManagedFundOrder.created_at.desc())
    )
    orders = result.scalars().all()
    return [
        MFOrderResponse(
            order_id=o.order_id,
            portfolio_id=o.portfolio_id,
            asset=o.asset,
            side=o.side,
            qty=float(o.qty or 0),
            price=float(o.price or 0) if o.price else None,
            status=o.status,
            order_type=o.order_type,
            notes=o.notes,
            created_at=o.created_at.isoformat() if o.created_at else None,
            updated_at=o.updated_at.isoformat() if o.updated_at else None,
        )
        for o in orders
    ]


@router.post("/{portfolio_id}/orders", response_model=MFOrderResponse, status_code=201)
async def create_order(portfolio_id: int, body: MFOrderCreate, db: AsyncSession = Depends(get_db)):
    asset = body.asset.upper()
    order = ManagedFundOrder(
        portfolio_id=portfolio_id,
        asset=asset,
        side=body.side,
        qty=Decimal(str(body.qty)),
        price=Decimal(str(body.price)) if body.price else None,
        order_type=body.order_type or 'manual',
        notes=body.notes,
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)
    return MFOrderResponse(
        order_id=order.order_id,
        portfolio_id=order.portfolio_id,
        asset=order.asset,
        side=order.side,
        qty=float(order.qty or 0),
        price=float(order.price or 0) if order.price else None,
        status=order.status,
        order_type=order.order_type,
        notes=order.notes,
        created_at=order.created_at.isoformat() if order.created_at else None,
        updated_at=order.updated_at.isoformat() if order.updated_at else None,
    )


@router.put("/{portfolio_id}/orders/{order_id}", response_model=MFOrderResponse)
async def update_order(portfolio_id: int, order_id: int, body: MFOrderUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ManagedFundOrder).where(
            ManagedFundOrder.order_id == order_id,
            ManagedFundOrder.portfolio_id == portfolio_id,
        )
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if body.asset is not None:
        order.asset = body.asset.upper()
    if body.side is not None:
        order.side = body.side
    if body.qty is not None:
        order.qty = Decimal(str(body.qty))
    if body.price is not None:
        order.price = Decimal(str(body.price))
    if body.notes is not None:
        order.notes = body.notes
    await db.commit()
    await db.refresh(order)
    return MFOrderResponse(
        order_id=order.order_id,
        portfolio_id=order.portfolio_id,
        asset=order.asset,
        side=order.side,
        qty=float(order.qty or 0),
        price=float(order.price or 0) if order.price else None,
        status=order.status,
        order_type=order.order_type,
        notes=order.notes,
        created_at=order.created_at.isoformat() if order.created_at else None,
        updated_at=order.updated_at.isoformat() if order.updated_at else None,
    )


@router.patch("/{portfolio_id}/orders/{order_id}/status", response_model=MFOrderResponse)
async def update_order_status(portfolio_id: int, order_id: int, body: MFOrderStatusUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ManagedFundOrder).where(
            ManagedFundOrder.order_id == order_id,
            ManagedFundOrder.portfolio_id == portfolio_id,
        )
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    new_status = body.status.lower()
    if new_status == "done":
        # Confirm order: update holdings, record NAV history
        await _confirm_order_done(db, portfolio_id, order)
    elif new_status == "cancelled":
        order.status = "cancelled"

    await db.commit()
    await db.refresh(order)

    if new_status == "done" or new_status == "cancelled":
        # Move to history
        history = ManagedFundOrderHistory(
            portfolio_id=order.portfolio_id,
            asset=order.asset,
            side=order.side,
            qty=order.qty,
            price=order.price,
            status=order.status,
            order_type=order.order_type,
            notes=order.notes,
            executed_at=datetime.utcnow(),
        )
        db.add(history)
        await db.delete(order)
        await db.commit()

    return MFOrderResponse(
        order_id=order.order_id,
        portfolio_id=order.portfolio_id,
        asset=order.asset,
        side=order.side,
        qty=float(order.qty or 0),
        price=float(order.price or 0) if order.price else None,
        status=order.status,
        order_type=order.order_type,
        notes=order.notes,
        created_at=order.created_at.isoformat() if order.created_at else None,
        updated_at=order.updated_at.isoformat() if order.updated_at else None,
    )


async def _confirm_order_done(db: AsyncSession, portfolio_id: int, order: ManagedFundOrder):
    order.status = "done"

    # Update holdings
    if order.side.lower() == "buy":
        existing = await db.execute(
            select(ManagedFundHolding).where(
                ManagedFundHolding.portfolio_id == portfolio_id,
                ManagedFundHolding.asset == order.asset,
            )
        )
        holding = existing.scalar_one_or_none()
        if holding:
            old_qty = float(holding.qty)
            old_avg = float(holding.avg_entry_price)
            new_qty = float(order.qty)
            new_price = float(order.price or 0)
            total_qty = old_qty + new_qty
            if total_qty > 0:
                holding.avg_entry_price = Decimal(str(
                    round(((old_qty * old_avg) + (new_qty * new_price)) / total_qty, 8)
                ))
            holding.qty = Decimal(str(total_qty))
            holding.market_value = holding.qty * holding.current_price
        else:
            holding = ManagedFundHolding(
                portfolio_id=portfolio_id,
                asset=order.asset,
                qty=order.qty,
                avg_entry_price=order.price or Decimal('0'),
                current_price=order.price or Decimal('0'),
                market_value=(order.qty * (order.price or Decimal('0'))),
            )
            db.add(holding)
    elif order.side.lower() == "sell":
        existing = await db.execute(
            select(ManagedFundHolding).where(
                ManagedFundHolding.portfolio_id == portfolio_id,
                ManagedFundHolding.asset == order.asset,
            )
        )
        holding = existing.scalar_one_or_none()
        if holding:
            new_qty = max(Decimal('0'), holding.qty - order.qty)
            if new_qty == 0:
                await db.delete(holding)
            else:
                holding.qty = new_qty
                holding.market_value = new_qty * holding.current_price

    # Update NAV via PortfolioNavHistory
    port_result = await db.execute(
        select(Portfolio).where(Portfolio.portfolio_id == portfolio_id)
    )
    portfolio = port_result.scalar_one_or_none()
    if portfolio:
        order_value = float(order.qty) * float(order.price or 0)
        if order.side.lower() == "buy":
            portfolio.available_cash = (portfolio.available_cash or Decimal('0')) - Decimal(str(order_value))
        elif order.side.lower() == "sell":
            portfolio.available_cash = (portfolio.available_cash or Decimal('0')) + Decimal(str(order_value))

        total_holdings_value = Decimal('0')
        holdings_result = await db.execute(
            select(ManagedFundHolding).where(ManagedFundHolding.portfolio_id == portfolio_id)
        )
        for h in holdings_result.scalars().all():
            total_holdings_value += (h.qty or Decimal('0')) * (h.current_price or Decimal('0'))

        new_nav = (portfolio.available_cash or Decimal('0')) + total_holdings_value
        portfolio.current_nav = new_nav

        today = date.today()
        nav_result = await db.execute(
            select(PortfolioNavHistory).where(
                PortfolioNavHistory.portfolio_id == portfolio_id,
                PortfolioNavHistory.nav_date == today,
            )
        )
        nav_rec = nav_result.scalar_one_or_none()
        if nav_rec:
            nav_rec.nav_value = new_nav
        else:
            db.add(PortfolioNavHistory(
                portfolio_id=portfolio_id,
                nav_date=today,
                nav_value=new_nav,
            ))

        setting_result = await db.execute(
            select(ManagedFundSetting).where(ManagedFundSetting.portfolio_id == portfolio_id)
        )
        setting = setting_result.scalar_one_or_none()
        if setting:
            if order.side.lower() == "buy":
                setting.total_invested = (setting.total_invested or Decimal('0')) + Decimal(str(order_value))
            setting.last_rebalance_date = datetime.utcnow()


# ─── Order History ───

@router.get("/{portfolio_id}/history", response_model=List[MFHistoryResponse])
async def list_history(portfolio_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ManagedFundOrderHistory)
        .where(ManagedFundOrderHistory.portfolio_id == portfolio_id)
        .order_by(ManagedFundOrderHistory.executed_at.desc())
    )
    rows = result.scalars().all()
    return [
        MFHistoryResponse(
            history_id=h.history_id,
            portfolio_id=h.portfolio_id,
            asset=h.asset,
            side=h.side,
            qty=float(h.qty or 0),
            price=float(h.price or 0) if h.price else None,
            status=h.status,
            order_type=h.order_type,
            notes=h.notes,
            executed_at=h.executed_at.isoformat() if h.executed_at else None,
        )
        for h in rows
    ]


# ─── Rebalance ───

@router.post("/{portfolio_id}/rebalance/calculate", response_model=MFRebalanceResponse)
async def calculate_rebalance(portfolio_id: int, db: AsyncSession = Depends(get_db)):
    port_result = await db.execute(
        select(Portfolio).where(Portfolio.portfolio_id == portfolio_id)
    )
    portfolio = port_result.scalar_one_or_none()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    setting_result = await db.execute(
        select(ManagedFundSetting).where(ManagedFundSetting.portfolio_id == portfolio_id)
    )
    setting = setting_result.scalar_one_or_none()
    if not setting or not setting.target_ratio:
        raise HTTPException(status_code=400, detail="No target ratio configured")

    target_ratio: Dict[str, float] = {
        k: float(v) for k, v in setting.target_ratio.items()
    }
    vals = list(target_ratio.values())
    if vals and max(vals) <= 1.0:
        target_ratio = {k: v * 100 for k, v in target_ratio.items()}

    holdings_result = await db.execute(
        select(ManagedFundHolding).where(ManagedFundHolding.portfolio_id == portfolio_id)
    )
    holdings = holdings_result.scalars().all()

    total_value = float(portfolio.current_nav or 0) or sum(
        float(h.qty or 0) * float(h.current_price or 0) for h in holdings
    )

    current_allocations: Dict[str, float] = {}
    for h in holdings:
        h_value = float(h.qty or 0) * float(h.current_price or 0)
        current_allocations[h.asset] = round((h_value / total_value * 100) if total_value > 0 else 0, 2)

    recommendations: List[MFRebalanceRecommendation] = []
    total_drift = 0.0
    prices = await registry.local_prices(
        db, portfolio.broker_id, list(target_ratio.keys())
    )

    for symbol, target_pct in target_ratio.items():
        current_pct = current_allocations.get(symbol, 0)
        drift = abs(target_pct - current_pct)
        total_drift += drift

        if drift < 0.5:
            continue

        diff_pct = target_pct - current_pct
        diff_value = total_value * abs(diff_pct) / 100
        estimated_price = 0.0

        # Price estimate comes from the broker-scoped registry quote.
        if diff_value > 0:
            estimated_price = prices.get(
                registry.normalise_symbol(symbol), 0.0
            )

            if estimated_price > 0:
                qty = round(diff_value / estimated_price, 8)
            else:
                qty = round(diff_value, 2)

            side = "Buy" if diff_pct > 0 else "Sell"
            recommendations.append(MFRebalanceRecommendation(
                symbol=symbol,
                side=side,
                qty=qty,
                estimated_price=estimated_price,
                reason=f"Drift {drift:.1f}%: rebalance from {current_pct:.1f}% to {target_pct:.1f}%",
                current_allocation=current_pct,
                target_allocation=target_pct,
                drift=round(drift, 2),
            ))

    return MFRebalanceResponse(
        portfolio_id=portfolio_id,
        portfolio_name=portfolio.portfolio_name,
        current_nav=float(portfolio.current_nav or 0),
        target_allocations=target_ratio,
        current_allocations=current_allocations,
        recommendations=recommendations,
        total_drift=round(total_drift, 2),
    )


# ─── Price Sync from the Asset Registry ───

def _holding_symbol_rank(
    portfolio_broker_id: Optional[int],
    row_broker_id: Optional[int],
    symbol_id: int,
) -> tuple[int, int, int]:
    """Registry row ranking: portfolio broker first, then lowest broker/symbol."""
    preferred = portfolio_broker_id is not None and row_broker_id == portfolio_broker_id
    fallback_broker = row_broker_id if row_broker_id is not None else 1_000_000_000
    return (0 if preferred else 1, fallback_broker, symbol_id)


def _pick_registry_rows(
    rows: Iterable[tuple[AssetSymbol, AssetProduct]],
    portfolio_broker_id: Optional[int],
) -> dict[str, tuple[AssetSymbol, AssetProduct]]:
    """Winning ``asset_symbols`` row per normalized ``price_symbol``."""
    best: dict[str, tuple[tuple[int, int, int], AssetSymbol, AssetProduct]] = {}
    for symbol, product in rows:
        key = registry.normalise_symbol(symbol.price_symbol)
        if key is None:
            continue
        rank = _holding_symbol_rank(
            portfolio_broker_id, symbol.broker_id, symbol.symbol_id
        )
        current = best.get(key)
        if current is None or rank < current[0]:
            best[key] = (rank, symbol, product)
    return {key: (symbol, product) for key, (_, symbol, product) in best.items()}


def _apply_holding_price(
    holding: ManagedFundHolding, price: Optional[Decimal]
) -> bool:
    """Apply one registry price to a holding; a missing/non-positive price is a no-op."""
    if price is None or price <= 0:
        return False
    holding.current_price = Decimal(str(price))
    holding.market_value = holding.qty * holding.current_price
    holding.unrealized_pl = (holding.current_price - holding.avg_entry_price) * holding.qty
    if holding.avg_entry_price and holding.avg_entry_price > 0:
        pl_pct = (
            (float(holding.current_price) - float(holding.avg_entry_price))
            / float(holding.avg_entry_price)
        ) * 100
        holding.unrealized_pl_pct = Decimal(str(round(pl_pct, 4)))
    return True


async def reprice_holdings_for_symbols(
    db: AsyncSession, pairs: Iterable[tuple[str, str]]
) -> int:
    """Reprice holdings whose resolved registry row is one of ``pairs``.

    ``pairs`` are the ``(source, sync_symbol)`` quotes a registry write just
    stored. A holding is repriced only when its own resolution — portfolio
    broker first, else the lowest broker id, then the lowest symbol id — picks
    that pair, so another broker's quote never moves it. The caller owns the
    transaction: this helper flushes and never commits.
    """
    wanted_pairs = {
        (registry.normalise_source(source), sync_symbol)
        for source, sync_symbol in pairs
        if sync_symbol
    }
    if not wanted_pairs:
        return 0

    sync_symbols = {sync_symbol for _, sync_symbol in wanted_pairs}
    sources = {source for source, _ in wanted_pairs}
    source_expr = func.coalesce(func.nullif(func.trim(AssetProduct.source), ""), "-")
    written_rows = (
        await db.execute(
            select(AssetSymbol, AssetProduct)
            .join(AssetProduct, AssetProduct.product_id == AssetSymbol.product_id)
            .where(
                AssetSymbol.price_symbol.isnot(None),
                AssetSymbol.sync_symbol.in_(sync_symbols),
                source_expr.in_(sources),
            )
        )
    ).all()
    written_keys = {
        key
        for symbol, product in written_rows
        if (registry.quote_source(product), symbol.sync_symbol) in wanted_pairs
        for key in [registry.normalise_symbol(symbol.price_symbol)]
        if key
    }
    if not written_keys:
        return 0

    # Every registry row for the affected keys, so a non-written winner still wins.
    registry_rows = (
        await db.execute(
            select(AssetSymbol, AssetProduct)
            .join(AssetProduct, AssetProduct.product_id == AssetSymbol.product_id)
            .where(
                AssetSymbol.price_symbol.isnot(None),
                func.upper(func.trim(AssetSymbol.price_symbol)).in_(written_keys),
            )
        )
    ).all()

    holding_rows = (
        await db.execute(
            select(ManagedFundHolding, Portfolio.broker_id)
            .join(Portfolio, Portfolio.portfolio_id == ManagedFundHolding.portfolio_id)
            .where(func.upper(func.trim(ManagedFundHolding.asset)).in_(written_keys))
        )
    ).all()

    resolutions: dict[
        tuple[str, Optional[int]], tuple[AssetSymbol, AssetProduct]
    ] = {}
    quotes: dict[tuple[str, str], Optional[Decimal]] = {}
    updated = 0
    for holding, broker_id in holding_rows:
        key = registry.normalise_symbol(holding.asset)
        if key is None:
            continue
        resolution_key = (key, broker_id)
        winner = resolutions.get(resolution_key)
        if resolution_key not in resolutions:
            matches = [
                (symbol, product)
                for symbol, product in registry_rows
                if registry.normalise_symbol(symbol.price_symbol) == key
            ]
            winner = _pick_registry_rows(matches, broker_id).get(key)
            resolutions[resolution_key] = winner
        if winner is None:
            continue
        symbol, product = winner
        pair = (registry.quote_source(product), symbol.sync_symbol)
        if pair not in wanted_pairs:
            continue
        price = quotes.get(pair)
        if pair not in quotes:
            quote = await registry.quote_for(db, product, symbol)
            price = quote.price if quote is not None else None
            quotes[pair] = price
        if _apply_holding_price(holding, price):
            updated += 1

    await db.flush()
    return updated


@router.post("/{portfolio_id}/sync-prices")
async def sync_prices(portfolio_id: int, db: AsyncSession = Depends(get_db)):
    """Refresh the registry quote behind every holding, then reprice the fund.

    The registry is the single price authority: each holding's ``asset`` is
    resolved to the same ``asset_symbols`` row ``local_prices`` prices from
    (portfolio broker first, else the lowest broker id, then the lowest symbol
    id). Price sources are fetched from the provider once per
    ``(source, sync_symbol)`` pair; a provider failure keeps the quote already
    stored in ``asset_quotes`` and never aborts the request.
    """
    portfolio = await db.get(Portfolio, portfolio_id)
    holdings_result = await db.execute(
        select(ManagedFundHolding).where(ManagedFundHolding.portfolio_id == portfolio_id)
    )
    holdings = holdings_result.scalars().all()
    broker_id = portfolio.broker_id if portfolio is not None else None

    wanted = sorted({
        symbol
        for symbol in (registry.normalise_symbol(holding.asset) for holding in holdings)
        if symbol
    })

    # Resolve the winning registry row per holding symbol.
    best_rows: dict[str, tuple[AssetSymbol, AssetProduct]] = {}
    if wanted:
        rows = (
            await db.execute(
                select(AssetSymbol, AssetProduct)
                .join(AssetProduct, AssetProduct.product_id == AssetSymbol.product_id)
                .where(
                    AssetSymbol.price_symbol.isnot(None),
                    func.upper(func.trim(AssetSymbol.price_symbol)).in_(wanted),
                )
            )
        ).all()
        best_rows = _pick_registry_rows(rows, broker_id)

    # One provider fetch per (source, sync_symbol); manual rows are never fetched.
    refresh_pairs: dict[tuple[str, str], tuple[AssetSymbol, AssetProduct, list[str]]] = {}
    for key, (symbol, product) in best_rows.items():
        source = registry.quote_source(product)
        if source not in registry.PRICE_SOURCES:
            continue
        pair = (source, symbol.sync_symbol)
        entry = refresh_pairs.get(pair)
        if entry is None:
            refresh_pairs[pair] = (symbol, product, [key])
        else:
            entry[2].append(key)

    refresh_failed: set[str] = set()
    for symbol, product, keys in refresh_pairs.values():
        try:
            await registry.refresh_symbol_quote(db, symbol, product)
        except Exception:
            # Keep the stored quote; the holding is repriced from it below.
            refresh_failed.update(keys)

    prices = await registry.local_prices(
        db, broker_id, [holding.asset for holding in holdings]
    )

    updated_count = 0
    synced_symbols: set[str] = set()
    for holding in holdings:
        key = registry.normalise_symbol(holding.asset)
        price = prices.get(key) if key else None
        if key and _apply_holding_price(holding, price):
            updated_count += 1
            synced_symbols.add(key)

    missing = [key for key in wanted if key not in best_rows]
    failed = [
        key
        for key in wanted
        if key in best_rows and (key not in synced_symbols or key in refresh_failed)
    ]

    await db.commit()
    return {
        "synced": updated_count,
        "total": len(holdings),
        "missing": missing,
        "failed": failed,
    }


# ─── Profit Threshold Alerts ───

@router.get("/{portfolio_id}/alerts", response_model=MFAlertsResponse)
async def check_alerts(portfolio_id: int, db: AsyncSession = Depends(get_db)):
    setting_result = await db.execute(
        select(ManagedFundSetting).where(ManagedFundSetting.portfolio_id == portfolio_id)
    )
    setting = setting_result.scalar_one_or_none()
    global_threshold = float(setting.global_profit_threshold or 0) if setting else 0

    holdings_result = await db.execute(
        select(ManagedFundHolding).where(ManagedFundHolding.portfolio_id == portfolio_id)
    )
    holdings = holdings_result.scalars().all()

    alerts: List[MFAlertItem] = []
    for h in holdings:
        pl_pct = float(h.unrealized_pl_pct or 0)
        threshold = max(float(h.profit_threshold or 0), global_threshold)
        if threshold > 0 and abs(pl_pct) >= threshold:
            alerts.append(MFAlertItem(
                asset=h.asset,
                qty=float(h.qty or 0),
                unrealized_pl_pct=pl_pct,
                threshold=threshold,
                message=f"{h.asset} P/L {pl_pct:+.2f}% exceeds threshold {threshold:.1f}%",
            ))

    return MFAlertsResponse(alerts=alerts)
