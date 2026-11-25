from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, and_, func
from sqlalchemy.exc import DataError, InterfaceError, OperationalError, StatementError
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from app.database import get_db, resolve_portfolio_db
from app.models import ActiveOrder, TradePlan, TradeHistory, Portfolio
from app.custom_models import CustomActiveOrder, CustomTradePlan
from app.services import asset_registry as registry
from app.services.hybrid_portfolio import (
    MAPPED_ORDER_SOURCE_DETAIL,
    ORDER_SOURCE_DASHBOARD,
    ORDER_SOURCE_MAPPED,
    fetch_local_option_order,
    fetch_local_option_orders,
    is_option_contract,
    local_order_row,
    merge_order_rows,
    validate_order_source,
)
from app.custom_mapping import (
    READ_ONLY_DETAIL,
    fetch_mapped_order,
    fetch_mapped_orders,
    insert_mapped_order,
    load_mapped_connection,
    mapped_engine,
    mapped_orders_write_capabilities,
    move_mapped_order_to_history,
    raise_if_mapped_readonly,
    update_mapped_order,
)
from pydantic import BaseModel, field_validator
from typing import Optional, Dict, Any, Iterable, List

router = APIRouter()


class ActiveOrderCreate(BaseModel):
    order_id: Optional[str] = None
    plan_id: Optional[int] = None
    portfolio_id: int
    asset_type: str
    side: str
    qty: Optional[float] = None
    entry_price: Optional[float] = None
    current_price: Optional[float] = None
    tp_price: Optional[float] = None
    sl_price: Optional[float] = None
    leverage: Optional[float] = None
    margin_rate: Optional[float] = None
    group_id: Optional[int] = None
    order_status: Optional[str] = None
    linked_order_id: Optional[str] = None
    contract_type: Optional[str] = 'spot'
    direction: Optional[str] = None
    option_type: Optional[str] = None
    expiry_date: Optional[datetime] = None
    strike_price: Optional[float] = None
    cost: Optional[float] = 0.0
    remark: Optional[str] = None
    order_ref: Optional[str] = None
    fee: Optional[float] = None

    @field_validator('expiry_date', mode='after')
    @classmethod
    def strip_tz(cls, v):
        if isinstance(v, datetime):
            return v.replace(tzinfo=None)
        return v


class ActiveOrderUpdate(BaseModel):
    asset_type: Optional[str] = None
    side: Optional[str] = None
    qty: Optional[float] = None
    entry_price: Optional[float] = None
    current_price: Optional[float] = None
    tp_price: Optional[float] = None
    sl_price: Optional[float] = None
    leverage: Optional[float] = None
    margin_rate: Optional[float] = None
    order_status: Optional[str] = None
    group_id: Optional[int] = None
    linked_order_id: Optional[str] = None
    contract_type: Optional[str] = None
    direction: Optional[str] = None
    option_type: Optional[str] = None
    expiry_date: Optional[datetime] = None
    strike_price: Optional[float] = None
    cost: Optional[float] = None
    remark: Optional[str] = None
    order_ref: Optional[str] = None
    fee: Optional[float] = None

    @field_validator('expiry_date', mode='after')
    @classmethod
    def strip_tz(cls, v):
        if isinstance(v, datetime):
            return v.replace(tzinfo=None)
        return v


class ActiveOrderResponse(BaseModel):
    order_id: str
    plan_id: Optional[int] = None
    portfolio_id: int
    asset_type: str
    underlying: str
    side: str
    qty: Optional[float]
    entry_price: Optional[float]
    current_price: Optional[float]
    tp_price: Optional[float]
    sl_price: Optional[float]
    leverage: Optional[float]
    margin_rate: Optional[float]
    order_status: str
    linked_order_id: Optional[str]
    group_id: Optional[int] = None
    contract_type: Optional[str] = 'spot'
    direction: Optional[str] = None
    option_type: Optional[str] = None
    expiry_date: Optional[datetime] = None
    strike_price: Optional[float] = None
    cost: Optional[float] = 0.0
    remark: Optional[str] = None
    order_ref: Optional[str] = None
    mark_price: Optional[float] = None
    fee: Optional[float] = None
    created_at: Optional[datetime] = None
    order_source: Optional[str] = None

    class Config:
        orm_mode = True
        from_attributes = True


def _mapped_response(
    order: dict,
    portfolio_id: int,
    order_source: str = ORDER_SOURCE_MAPPED,
) -> dict:
    """Shape a normalised mapped order for ActiveOrderResponse."""
    shaped = dict(order)
    shaped["portfolio_id"] = portfolio_id
    shaped.setdefault("plan_id", None)
    shaped["order_source"] = order_source
    # A mapped row's contract lives in the foreign schema; the local registry
    # never owns its spec, so the underlying is always unassigned.
    shaped["underlying"] = ""
    return shaped


def _require_mapped_order_source(order_source: Optional[str]) -> str:
    """The required source query on mapped single-row routes (400 when bad)."""
    source = validate_order_source(order_source)
    if source is None:
        raise HTTPException(status_code=400, detail=MAPPED_ORDER_SOURCE_DETAIL)
    return source


_CONNECTION_ERROR_NAMES = frozenset(
    {
        "CannotConnectNowError",
        "ClientCannotConnectError",
        "ConnectionDoesNotExistError",
        "ConnectionError",
        "ConnectionFailureError",
        "ConnectionTimeoutError",
        "InterfaceError",
        "InvalidCatalogNameError",
        "InvalidPasswordError",
        "OperationalError",
        "TooManyConnectionsError",
    }
)


def _is_invalid_store_key(exc: BaseException) -> bool:
    """True when a mapped key was rejected for its type/format, not connectivity.

    A local-style id sent to a foreign UUID/TEXT key column fails during bind
    or execution with a driver ``DataError`` (or a SQLAlchemy ``StatementError``
    wrapping it). That means "no such row in this store", not an outage. Real
    connection/operational failures are never classified as a missing key.
    """
    pending: list[BaseException] = [exc]
    seen: set[int] = set()
    key_error = False
    connection_error = False
    while pending:
        current = pending.pop()
        if current is None or id(current) in seen:
            continue
        seen.add(id(current))

        if isinstance(current, (OperationalError, InterfaceError, ConnectionError)):
            connection_error = True
        name = type(current).__name__
        if name in _CONNECTION_ERROR_NAMES:
            connection_error = True
        if isinstance(current, (DataError, StatementError)) or name in (
            "DataError",
            "InvalidTextRepresentationError",
        ):
            key_error = True
        sqlstate = getattr(current, "sqlstate", None)
        if isinstance(sqlstate, str) and sqlstate.startswith("22"):
            key_error = True

        for attribute in ("orig", "__cause__", "__context__"):
            nested = getattr(current, attribute, None)
            if isinstance(nested, BaseException):
                pending.append(nested)

    return key_error and not connection_error


async def _mapped_store_result(awaitable):
    """Await one named-store call, mapping a key-type driver error to 404."""
    try:
        return await awaitable
    except HTTPException:
        raise
    except Exception as exc:
        if _is_invalid_store_key(exc):
            raise HTTPException(status_code=404, detail="Order not found") from exc
        raise


async def _assert_broker_scoped_spec(db: AsyncSession, portfolio, symbol: str) -> None:
    """Require a broker and a broker-scoped contract spec for an order symbol."""
    if portfolio is None or portfolio.broker_id is None:
        raise HTTPException(
            status_code=400,
            detail="Assign a broker in Edit portfolio before adding orders",
        )
    normalized = registry.normalise_symbol(symbol)
    specs = await registry.resolve_symbol_specs(db, portfolio.broker_id, [normalized])
    if normalized is not None and normalized in specs:
        return
    broker_code = await registry.broker_code(db, portfolio.broker_id)
    broker_code = broker_code or str(portfolio.broker_id)
    raise HTTPException(
        status_code=400,
        detail=(
            f"No contract spec for {normalized} on broker {broker_code} "
            "— add it in All-assets first"
        ),
    )


async def _assert_order_contract_spec(db: AsyncSession, portfolio: Portfolio, symbol: str) -> None:
    """Local, non-custom Active Trading orders need a broker-scoped symbol spec."""
    if portfolio is None or portfolio.port_type != "Active Trading":
        return
    await _assert_broker_scoped_spec(db, portfolio, symbol)


async def _create_main_order_row(db: AsyncSession, data: dict) -> ActiveOrder:
    """Insert one dashboard ``ActiveOrder`` with the default-plan behaviour."""
    if data.get("plan_id") is None:
        result = await db.execute(
            select(TradePlan)
            .where(TradePlan.portfolio_id == data["portfolio_id"])
            .limit(1)
        )
        existing = result.scalar_one_or_none()
        if existing:
            data["plan_id"] = existing.plan_id
        else:
            default_plan = TradePlan(portfolio_id=data["portfolio_id"])
            db.add(default_plan)
            await db.flush()
            data["plan_id"] = default_plan.plan_id
    db_order = ActiveOrder(**data)
    db.add(db_order)
    await db.commit()
    await db.refresh(db_order)
    return db_order


async def _broker_by_portfolio(
    db: AsyncSession, portfolio_ids: Iterable[Optional[int]]
) -> dict[int, Optional[int]]:
    """portfolio_id -> broker_id for the given ids (one query per request)."""
    wanted = {portfolio_id for portfolio_id in portfolio_ids if portfolio_id is not None}
    if not wanted:
        return {}
    rows = (
        await db.execute(
            select(Portfolio.portfolio_id, Portfolio.broker_id).where(
                Portfolio.portfolio_id.in_(wanted)
            )
        )
    ).all()
    return {portfolio_id: broker_id for portfolio_id, broker_id in rows}


async def _attach_underlying(db: AsyncSession, rows: list) -> None:
    """Fill ``underlying`` on canonical order dicts or ORM order instances.

    The underlying is the ticker of the product that owns the order's contract
    spec (``price_symbol`` = the order's ``asset_type``) inside the order's
    portfolio broker scope. One batched registry lookup per request; an unknown
    symbol, a brokerless portfolio or a missing spec yields ``""``.
    """
    if not rows:
        return

    def field(row, name):
        return row.get(name) if isinstance(row, dict) else getattr(row, name, None)

    pairs = [(field(row, "portfolio_id"), field(row, "asset_type")) for row in rows]
    brokers = await _broker_by_portfolio(db, [portfolio_id for portfolio_id, _ in pairs])
    resolved = await registry.resolve_underlyings(
        db, [(brokers.get(portfolio_id), symbol) for portfolio_id, symbol in pairs]
    )
    for row, (portfolio_id, symbol) in zip(rows, pairs):
        key = (brokers.get(portfolio_id), registry.normalise_symbol(symbol))
        underlying = resolved.get(key, "")
        if isinstance(row, dict):
            row["underlying"] = underlying
        else:
            row.underlying = underlying


async def _with_underlying(db: AsyncSession, row):
    """Single-row convenience wrapper around :func:`_attach_underlying`."""
    await _attach_underlying(db, [row])
    return row


@router.get("", tags=["orders"], response_model=List[ActiveOrderResponse])
async def list_orders(
    db: AsyncSession = Depends(get_db),
    portfolio_id: Optional[int] = None,
):
    """List all active orders."""
    connection = await load_mapped_connection(db, portfolio_id)
    if connection is not None:
        local_orders = await fetch_local_option_orders(db, portfolio_id)
        dashboard_rows = [local_order_row(order) for order in local_orders]
        await _attach_underlying(db, dashboard_rows)
        try:
            engine = await mapped_engine(connection)
            orders = await fetch_mapped_orders(engine, connection.mapping_config)
        except Exception:
            # The connected database is down: keep the dashboard-local option
            # rows visible instead of failing the whole list. Analytics carries
            # the degraded banner for this portfolio.
            return dashboard_rows
        mapped_rows = [
            _mapped_response(order, portfolio_id or 0) for order in orders
        ]
        return merge_order_rows(dashboard_rows, mapped_rows)
    session, is_custom = await resolve_portfolio_db(db, portfolio_id)
    try:
        ModelClass = CustomActiveOrder if is_custom else ActiveOrder
        result = await session.execute(select(ModelClass))
        orders = list(result.scalars().all())
        await _attach_underlying(db, orders)
        return orders
    finally:
        if is_custom:
            await session.close()


@router.post("", tags=["orders"], status_code=status.HTTP_201_CREATED, response_model=ActiveOrderResponse)
async def create_order(order: ActiveOrderCreate, db: AsyncSession = Depends(get_db)):
    """Create a new active order. If plan_id is omitted, auto-resolve or create a default trade plan."""
    connection = await load_mapped_connection(db, order.portfolio_id)
    if connection is not None:
        if is_option_contract(order.contract_type):
            # Dashboard-local option path: the strict Active Trading guard and
            # the main ActiveOrder/TradePlan tables. Never touches the foreign
            # write capabilities or its columns.
            portfolio = await db.get(Portfolio, order.portfolio_id)
            await _assert_broker_scoped_spec(db, portfolio, order.asset_type)
            data = order.dict(exclude_none=True)
            data.pop("order_ref", None)
            data.pop("fee", None)
            data["contract_type"] = "option"
            db_order = await _create_main_order_row(db, data)
            return await _with_underlying(db, local_order_row(db_order))

        config = connection.mapping_config
        caps = mapped_orders_write_capabilities(config)
        if not caps or not caps.get("insert"):
            raise HTTPException(status_code=409, detail=READ_ONLY_DETAIL)
        data = order.dict(exclude_unset=True, exclude_none=True)
        data.pop("portfolio_id", None)
        data.pop("plan_id", None)
        engine = await mapped_engine(connection)
        try:
            created = await insert_mapped_order(engine, config, data)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        stored = await fetch_mapped_order(engine, config, created["order_id"])
        payload = stored or {**created, "order_status": "open", "asset_type": order.asset_type, "side": order.side}
        return _mapped_response(payload, order.portfolio_id)
    await raise_if_mapped_readonly(db, order.portfolio_id)
    session, is_custom = await resolve_portfolio_db(db, order.portfolio_id)
    try:
        ModelClass = CustomActiveOrder if is_custom else ActiveOrder
        # Local, non-custom Active Trading: the order's own symbol must exist as
        # a broker-scoped contract spec. Managed Fund / Spread Strategy / custom
        # and mapped branches bypass this guard.
        if not is_custom:
            pf = await db.get(Portfolio, order.portfolio_id)
            await _assert_order_contract_spec(db, pf, order.asset_type)
        data = order.dict(exclude_none=True)
        data.pop("order_ref", None)
        data.pop("fee", None)
        if is_custom:
            if data.get("plan_id") is None:
                result = await session.execute(
                    select(CustomTradePlan).where(CustomTradePlan.portfolio_id == data["portfolio_id"]).limit(1)
                )
                existing = result.scalar_one_or_none()
                if existing:
                    data["plan_id"] = existing.plan_id
                else:
                    default_plan = CustomTradePlan(portfolio_id=data["portfolio_id"])
                    session.add(default_plan)
                    await session.flush()
                    data["plan_id"] = default_plan.plan_id
            db_order = ModelClass(**data)
            session.add(db_order)
            await session.commit()
            await session.refresh(db_order)
            return await _with_underlying(db, db_order)
        db_order = await _create_main_order_row(db, data)
        return await _with_underlying(db, db_order)
    finally:
        if is_custom:
            await session.close()


@router.get("/{order_id}", tags=["orders"], response_model=ActiveOrderResponse)
async def get_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    portfolio_id: Optional[int] = None,
    order_source: Optional[str] = None,
):
    """Get a single active order by ID."""
    connection = await load_mapped_connection(db, portfolio_id)
    if connection is not None:
        source = _require_mapped_order_source(order_source)
        if source == ORDER_SOURCE_DASHBOARD:
            order = await fetch_local_option_order(db, portfolio_id, order_id)
            if order is None:
                raise HTTPException(status_code=404, detail="Order not found")
            return await _with_underlying(db, local_order_row(order))
        engine = await mapped_engine(connection)
        order = await _mapped_store_result(
            fetch_mapped_order(engine, connection.mapping_config, order_id)
        )
        if order is None:
            raise HTTPException(status_code=404, detail="Order not found")
        return _mapped_response(order, portfolio_id or 0)
    session, is_custom = await resolve_portfolio_db(db, portfolio_id)
    try:
        ModelClass = CustomActiveOrder if is_custom else ActiveOrder
        result = await session.execute(select(ModelClass).where(ModelClass.order_id == order_id))
        order = result.scalar_one_or_none()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        return await _with_underlying(db, order)
    finally:
        if is_custom:
            await session.close()


@router.patch("/{order_id}/status", tags=["orders"])
async def update_order_status(
    order_id: str,
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    portfolio_id: Optional[int] = None,
    order_source: Optional[str] = None,
):
    """Update order status. If CANCELED, delete from active_orders and create trade history."""
    connection = await load_mapped_connection(db, portfolio_id)
    if connection is not None:
        source = _require_mapped_order_source(order_source)
        if source == ORDER_SOURCE_DASHBOARD:
            order = await fetch_local_option_order(db, portfolio_id, order_id)
            if order is None:
                raise HTTPException(status_code=404, detail="Order not found")

            new_status = payload.get("new_status")
            if not new_status:
                return {"order_id": order.order_id, "order_status": order.order_status}

            if new_status.upper() == "CANCELED":
                now = datetime.utcnow()
                history = TradeHistory(
                    portfolio_id=order.portfolio_id,
                    order_id=order.order_id,
                    group_id=order.group_id,
                    type=order.side,
                    asset=order.asset_type,
                    amount=float(order.qty) if order.qty else None,
                    entry_price=float(order.entry_price) if order.entry_price else None,
                    executed_by=order.executed_by or "Manual",
                    entry_date=order.created_at or now,
                    exit_date=now,
                    remark={"note": "Canceled"},
                    order_remark=order.remark,
                )
                db.add(history)
                await db.delete(order)
                await db.commit()
                await db.refresh(history)
                return {
                    "order_id": order.order_id,
                    "order_status": "CANCELED",
                    "history_id": history.history_id,
                }

            order.order_status = new_status
            await db.commit()
            return {"order_id": order.order_id, "order_status": order.order_status}

        config = connection.mapping_config
        caps = mapped_orders_write_capabilities(config) or {}
        engine = await mapped_engine(connection)
        current = await _mapped_store_result(
            fetch_mapped_order(engine, config, order_id)
        )
        if current is None:
            raise HTTPException(status_code=404, detail="Order not found")
        new_status = payload.get("new_status")
        if not new_status:
            return {"order_id": order_id, "order_status": current.get("order_status")}
        if new_status.upper() != "CANCELED":
            raise HTTPException(status_code=409, detail=READ_ONLY_DETAIL)
        if not caps.get("delete"):
            raise HTTPException(status_code=409, detail=READ_ONLY_DETAIL)
        try:
            result = await _mapped_store_result(
                move_mapped_order_to_history(
                    engine, config, order_id, mode="cancel"
                )
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        if result is None:
            raise HTTPException(status_code=404, detail="Order not found")
        return result
    await raise_if_mapped_readonly(db, portfolio_id)
    session, is_custom = await resolve_portfolio_db(db, portfolio_id)
    try:
        ModelClass = CustomActiveOrder if is_custom else ActiveOrder
        result = await session.execute(select(ModelClass).where(ModelClass.order_id == order_id))
        order = result.scalar_one_or_none()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        new_status = payload.get("new_status")
        if not new_status:
            return {"order_id": order.order_id, "order_status": order.order_status}

        if new_status.upper() == "CANCELED":
            now = datetime.utcnow()
            history = TradeHistory(
                portfolio_id=order.portfolio_id,
                order_id=order.order_id,
                group_id=order.group_id,
                type=order.side,
                asset=order.asset_type,
                amount=float(order.qty) if order.qty else None,
                entry_price=float(order.entry_price) if order.entry_price else None,
                executed_by=order.executed_by or "Manual",
                entry_date=order.created_at or now,
                exit_date=now,
                remark={"note": "Canceled"},
                order_remark=order.remark,
            )
            db.add(history)
            await session.delete(order)
            if is_custom:
                await db.commit()
                await session.commit()
            else:
                await db.commit()
            await db.refresh(history)
            return {"order_id": order.order_id, "order_status": "CANCELED", "history_id": history.history_id}

        order.order_status = new_status
        await session.commit()
        return {"order_id": order.order_id, "order_status": order.order_status}
    finally:
        if is_custom:
            await session.close()


@router.put("/{order_id}", tags=["orders"], response_model=ActiveOrderResponse)
async def update_order(
    order_id: str,
    order_update: ActiveOrderUpdate,
    db: AsyncSession = Depends(get_db),
    portfolio_id: Optional[int] = None,
    order_source: Optional[str] = None,
):
    """Update an active order with new values."""
    connection = await load_mapped_connection(db, portfolio_id)
    if connection is not None:
        source = _require_mapped_order_source(order_source)
        if source == ORDER_SOURCE_DASHBOARD:
            order = await fetch_local_option_order(db, portfolio_id, order_id)
            if order is None:
                raise HTTPException(status_code=404, detail="Order not found")

            update_data = order_update.dict(exclude_unset=True)
            update_data.pop("order_ref", None)
            update_data.pop("fee", None)
            if (
                "asset_type" in update_data
                and registry.normalise_symbol(update_data["asset_type"])
                != registry.normalise_symbol(order.asset_type)
            ):
                pf = await db.get(Portfolio, order.portfolio_id)
                await _assert_broker_scoped_spec(db, pf, update_data["asset_type"])
            for field, value in update_data.items():
                setattr(order, field, value)
            await db.commit()
            await db.refresh(order)
            return await _with_underlying(db, local_order_row(order))

        config = connection.mapping_config
        caps = mapped_orders_write_capabilities(config) or {}
        if not caps.get("update"):
            raise HTTPException(status_code=409, detail=READ_ONLY_DETAIL)
        engine = await mapped_engine(connection)
        changes = order_update.dict(exclude_unset=True)
        try:
            updated = await _mapped_store_result(
                update_mapped_order(engine, config, order_id, changes)
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        if updated is None:
            raise HTTPException(status_code=404, detail="Order not found")
        return _mapped_response(updated, portfolio_id or 0)
    await raise_if_mapped_readonly(db, portfolio_id)
    session, is_custom = await resolve_portfolio_db(db, portfolio_id)
    try:
        ModelClass = CustomActiveOrder if is_custom else ActiveOrder
        result = await session.execute(select(ModelClass).where(ModelClass.order_id == order_id))
        order = result.scalar_one_or_none()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        update_data = order_update.dict(exclude_unset=True)
        update_data.pop("order_ref", None)
        update_data.pop("fee", None)
        if (
            not is_custom
            and "asset_type" in update_data
            and registry.normalise_symbol(update_data["asset_type"])
            != registry.normalise_symbol(order.asset_type)
        ):
            # Resolve the portfolio from the loaded ORDER, never the optional
            # query parameter, so a misleading parameter cannot skip the guard.
            pf = await db.get(Portfolio, order.portfolio_id)
            await _assert_order_contract_spec(db, pf, update_data["asset_type"])
        for field, value in update_data.items():
            setattr(order, field, value)

        await session.commit()
        await session.refresh(order)
        return await _with_underlying(db, order)
    finally:
        if is_custom:
            await session.close()


class CloseOrderRequest(BaseModel):
    exit_price: Optional[float] = None
    realized_pl: Optional[float] = None
    decision_note: Optional[str] = None
    close_order_id: Optional[str] = None
    cost: Optional[float] = 0.0


@router.post("/{order_id}/unlink", tags=["orders"])
async def unlink_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    portfolio_id: Optional[int] = None,
):
    """Unlink an order from its linked partner. Clears linked_order_id on both sides."""
    await raise_if_mapped_readonly(db, portfolio_id)
    session, is_custom = await resolve_portfolio_db(db, portfolio_id)
    try:
        ModelClass = CustomActiveOrder if is_custom else ActiveOrder
        result = await session.execute(select(ModelClass).where(ModelClass.order_id == order_id))
        order = result.scalar_one_or_none()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        partner_id = order.linked_order_id
        order.linked_order_id = None

        if partner_id:
            result2 = await session.execute(select(ModelClass).where(ModelClass.order_id == partner_id))
            partner = result2.scalar_one_or_none()
            if partner and partner.linked_order_id == order_id:
                partner.linked_order_id = None

        await session.commit()
        return {"order_id": order.order_id, "linked_order_id": None, "unlinked_partner": partner_id}
    finally:
        if is_custom:
            await session.close()


async def _close_dashboard_option_order(
    db: AsyncSession, order: ActiveOrder, req: CloseOrderRequest
) -> dict:
    """Close one dashboard-local option row in a single main-DB transaction."""
    now = datetime.utcnow()

    def make_history(o, exit_price, realized_pl, close_order_id, decision_note):
        return TradeHistory(
            portfolio_id=o.portfolio_id,
            order_id=o.order_id,
            close_order_id=close_order_id,
            group_id=o.group_id,
            type=o.side,
            asset=o.asset_type,
            amount=float(o.qty) if o.qty else None,
            entry_price=float(o.entry_price) if o.entry_price else None,
            exit_price=exit_price or (float(o.current_price) if o.current_price else None),
            realized_pl=realized_pl,
            executed_by=o.executed_by or "Manual",
            decision_note=decision_note,
            entry_date=o.created_at or now,
            exit_date=now,
            remark={"cost": float(req.cost or 0)},
            order_remark=o.remark,
        )

    option_scope = and_(
        ActiveOrder.portfolio_id == order.portfolio_id,
        func.lower(func.trim(ActiveOrder.contract_type)) == "option",
    )
    sub_result = await db.execute(
        select(ActiveOrder).where(
            ActiveOrder.linked_order_id == order.order_id,
            ActiveOrder.order_id != order.order_id,
            option_scope,
        )
    )
    sub_orders = list(sub_result.scalars().all())

    auto_closed = []
    for sub in sub_orders:
        if order.linked_order_id == sub.order_id:
            continue
        sub_history = make_history(sub, req.exit_price, req.realized_pl, None, req.decision_note)
        db.add(sub_history)
        await db.delete(sub)
        await db.flush()
        auto_closed.append({"order_id": sub.order_id, "history_id": sub_history.history_id})

    history = make_history(order, req.exit_price, req.realized_pl, req.close_order_id, req.decision_note)
    db.add(history)
    await db.delete(order)
    await db.commit()
    await db.refresh(history)

    resp = {
        "order_id": order.order_id,
        "order_status": "CLOSE",
        "history_id": history.history_id,
    }
    if auto_closed:
        resp["auto_closed"] = auto_closed

    if order.linked_order_id:
        partner_result = await db.execute(
            select(ActiveOrder).where(
                ActiveOrder.order_id == order.linked_order_id,
                option_scope,
            )
        )
        partner = partner_result.scalar_one_or_none()
        if partner and partner.linked_order_id == order.order_id:
            resp["paired_order_id"] = partner.order_id

    return resp


@router.post("/{order_id}/close", tags=["orders"])
async def close_order(
    order_id: str,
    req: CloseOrderRequest,
    db: AsyncSession = Depends(get_db),
    portfolio_id: Optional[int] = None,
    order_source: Optional[str] = None,
):
    """Close an active order: delete from active_orders and create trade history record(s).
    Auto-closes all sub-orders that one-way link to this order (linked_order_id == this order_id).
    If this order is cross-linked (spread pair), signals frontend for the paired order."""
    connection = await load_mapped_connection(db, portfolio_id)
    if connection is not None:
        source = _require_mapped_order_source(order_source)
        if source == ORDER_SOURCE_DASHBOARD:
            order = await fetch_local_option_order(db, portfolio_id, order_id)
            if order is None:
                raise HTTPException(status_code=404, detail="Order not found")
            return await _close_dashboard_option_order(db, order, req)

        config = connection.mapping_config
        caps = mapped_orders_write_capabilities(config) or {}
        if not caps.get("delete"):
            raise HTTPException(status_code=409, detail=READ_ONLY_DETAIL)
        engine = await mapped_engine(connection)
        try:
            result = await _mapped_store_result(
                move_mapped_order_to_history(
                    engine,
                    config,
                    order_id,
                    mode="close",
                    exit_price=req.exit_price,
                    realized_pl=req.realized_pl,
                )
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        if result is None:
            raise HTTPException(status_code=404, detail="Order not found")
        return result
    await raise_if_mapped_readonly(db, portfolio_id)
    session, is_custom = await resolve_portfolio_db(db, portfolio_id)
    try:
        ModelClass = CustomActiveOrder if is_custom else ActiveOrder
        result = await session.execute(select(ModelClass).where(ModelClass.order_id == order_id))
        order = result.scalar_one_or_none()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        now = datetime.utcnow()

        def make_history(o, exit_price, realized_pl, close_order_id, decision_note):
            return TradeHistory(
                portfolio_id=o.portfolio_id,
                order_id=o.order_id,
                close_order_id=close_order_id,
                group_id=o.group_id,
                type=o.side,
                asset=o.asset_type,
                amount=float(o.qty) if o.qty else None,
                entry_price=float(o.entry_price) if o.entry_price else None,
                exit_price=exit_price or (float(o.current_price) if o.current_price else None),
                realized_pl=realized_pl,
                executed_by=o.executed_by or "Manual",
                decision_note=decision_note,
                entry_date=o.created_at or now,
                exit_date=now,
                remark={"cost": float(req.cost or 0)},
                order_remark=o.remark,
            )

        sub_result = await session.execute(
            select(ModelClass).where(
                and_(ModelClass.linked_order_id == order_id, ModelClass.order_id != order_id)
            )
        )
        sub_orders = sub_result.scalars().all()

        auto_closed = []
        for sub in sub_orders:
            if order.linked_order_id == sub.order_id:
                continue
            sub_history = make_history(sub, req.exit_price, req.realized_pl, None, req.decision_note)
            db.add(sub_history)
            await session.delete(sub)
            await db.flush()
            auto_closed.append({"order_id": sub.order_id, "history_id": sub_history.history_id})

        history = make_history(order, req.exit_price, req.realized_pl, req.close_order_id, req.decision_note)
        db.add(history)
        await session.delete(order)

        if is_custom:
            await db.commit()
            await session.commit()
        else:
            await db.commit()
        await db.refresh(history)

        resp = {
            "order_id": order.order_id,
            "order_status": "CLOSE",
            "history_id": history.history_id,
        }
        if auto_closed:
            resp["auto_closed"] = auto_closed

        if order.linked_order_id:
            partner_result = await session.execute(
                select(ModelClass).where(ModelClass.order_id == order.linked_order_id)
            )
            partner = partner_result.scalar_one_or_none()
            if partner and partner.linked_order_id == order.order_id:
                resp["paired_order_id"] = partner.order_id

        return resp
    finally:
        if is_custom:
            await session.close()


class LinkOrderRequest(BaseModel):
    target_order_id: str


@router.post("/{order_id}/link", tags=["orders"])
async def link_order(
    order_id: str,
    req: LinkOrderRequest,
    db: AsyncSession = Depends(get_db),
    portfolio_id: Optional[int] = None,
):
    """Link order to a target order by setting linked_order_id (one-way = pending close).
    For two-way (spread), the target order must also link back."""
    await raise_if_mapped_readonly(db, portfolio_id)
    session, is_custom = await resolve_portfolio_db(db, portfolio_id)
    try:
        ModelClass = CustomActiveOrder if is_custom else ActiveOrder
        result = await session.execute(select(ModelClass).where(ModelClass.order_id == order_id))
        order = result.scalar_one_or_none()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        result = await session.execute(select(ModelClass).where(ModelClass.order_id == req.target_order_id))
        target = result.scalar_one_or_none()
        if not target:
            raise HTTPException(status_code=404, detail="Target order not found")

        if req.target_order_id == order_id:
            raise HTTPException(status_code=400, detail="Cannot link order to itself")
        order.linked_order_id = req.target_order_id
        await session.commit()
        return {"order_id": order.order_id, "linked_order_id": order.linked_order_id}
    finally:
        if is_custom:
            await session.close()