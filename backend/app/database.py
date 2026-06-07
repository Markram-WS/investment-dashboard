import os
import asyncio
from datetime import datetime, timedelta
from typing import AsyncGenerator, Optional

from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, text

from app.models import Base, Portfolio, CustomPortfolioConnection
from app.utils.crypto import decrypt_password
from app.custom_models import custom_metadata

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://dashboard:dashboard@localhost:5432/investment_main"
)
AI_DATABASE_URL = os.getenv(
    "AI_DATABASE_URL",
    "postgresql+asyncpg://dashboard:dashboard@localhost:5433/investment_ai"
)

engine = create_async_engine(DATABASE_URL, echo=False, future=True)
ai_engine = create_async_engine(AI_DATABASE_URL, echo=False, future=True)

AsyncSessionLocal = sessionmaker(
    bind=engine, class_=AsyncSession, expire_on_commit=False
)
AIAsyncSessionLocal = sessionmaker(
    bind=ai_engine, class_=AsyncSession, expire_on_commit=False
)

CUSTOM_ENGINES: dict[int, tuple[AsyncEngine, datetime]] = {}
CUSTOM_INITIALIZED: set[int] = set()
ENGINE_TTL = timedelta(minutes=30)

CUSTOM_TABLES_MODELS = [
    "CustomActiveOrder",
    "CustomTransaction",
    "CustomWhitelistAssets",
    "CustomAssetGroup",
    "CustomOrdersGroup",
    "CustomTradePlan",
]


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session


async def get_ai_db() -> AsyncSession:
    async with AIAsyncSessionLocal() as session:
        yield session


async def get_or_create_custom_engine(connection: CustomPortfolioConnection) -> AsyncEngine:
    pid = connection.portfolio_id
    now = datetime.utcnow()

    if pid in CUSTOM_ENGINES:
        engine_entry, last_used = CUSTOM_ENGINES[pid]
        if now - last_used < ENGINE_TTL:
            return engine_entry

    password = decrypt_password(connection.encrypted_password)
    url = (
        f"postgresql+asyncpg://{connection.db_user}:{password}"
        f"@{connection.db_host}:{connection.db_port}/{connection.db_name}"
    )
    custom_engine = create_async_engine(url, echo=False, future=True, pool_pre_ping=True)
    CUSTOM_ENGINES[pid] = (custom_engine, now)
    return custom_engine


async def ensure_custom_tables(engine: AsyncEngine, portfolio_id: int) -> None:
    if portfolio_id in CUSTOM_INITIALIZED:
        return
    async with engine.begin() as conn:
        await conn.run_sync(custom_metadata.create_all)
        for table_name, table in custom_metadata.tables.items():
            result = await conn.execute(
                text(f"SELECT column_name FROM information_schema.columns WHERE table_name = '{table_name}'")
            )
            actual_columns = {row[0] for row in result.fetchall()}
            for col in table.columns:
                if col.name in actual_columns:
                    continue
                col_type = col.type.compile(engine.dialect)
                nullable = "NULL" if col.nullable else "NOT NULL"
                default = ""
                if col.default is not None:
                    raw = col.default.arg
                    if isinstance(raw, str):
                        default = f" DEFAULT '{raw}'"
                    elif isinstance(raw, (int, float, bool)):
                        default = f" DEFAULT {raw}"
                elif not col.nullable:
                    if "VARCHAR" in col_type.upper():
                        default = " DEFAULT ''"
                    elif "INTEGER" in col_type.upper() or "NUMERIC" in col_type.upper():
                        default = " DEFAULT 0"
                sql = f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {col.name} {col_type} {nullable}{default}"
                try:
                    await conn.execute(text(sql))
                except Exception:
                    pass
        # Drop FK constraints that conflict with FK-free model design
        for table_name in custom_metadata.tables:
            fk_result = await conn.execute(text(f"""
                SELECT constraint_name
                FROM information_schema.table_constraints
                WHERE table_name = '{table_name}'
                AND constraint_type = 'FOREIGN KEY'
            """))
            for row in fk_result.fetchall():
                try:
                    await conn.execute(text(f'ALTER TABLE {table_name} DROP CONSTRAINT IF EXISTS {row[0]}'))
                except Exception:
                    pass
    CUSTOM_INITIALIZED.add(portfolio_id)


async def get_portfolio_db(portfolio_id: int) -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as main_session:
        result = await main_session.execute(
            select(Portfolio).where(Portfolio.portfolio_id == portfolio_id)
        )
        portfolio = result.scalar_one_or_none()
        if not portfolio:
            raise RuntimeError(f"Portfolio {portfolio_id} not found")

        if not portfolio.is_custom:
            async with AsyncSessionLocal() as session:
                yield session
            return

        conn_result = await main_session.execute(
            select(CustomPortfolioConnection).where(
                CustomPortfolioConnection.portfolio_id == portfolio_id
            )
        )
        connection = conn_result.scalar_one_or_none()
        if not connection:
            raise RuntimeError(f"Custom connection not found for portfolio {portfolio_id}")

        custom_engine = await get_or_create_custom_engine(connection)
        await ensure_custom_tables(custom_engine, portfolio_id)

        CustomSessionLocal = sessionmaker(
            bind=custom_engine, class_=AsyncSession, expire_on_commit=False
        )
        async with CustomSessionLocal() as session:
            yield session


async def get_custom_session(conn: CustomPortfolioConnection) -> AsyncSession:
    engine = await get_or_create_custom_engine(conn)
    await ensure_custom_tables(engine, conn.portfolio_id)
    maker = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    return maker()


async def resolve_portfolio_db(
    main_session: AsyncSession,
    portfolio_id: Optional[int],
) -> tuple[AsyncSession | None, bool]:
    """
    Resolve the correct database session for a portfolio.
    Returns (session, is_custom) tuple.
    If is_custom is True, caller must close the session.
    If False, main_session is returned (caller should not close it).
    Returns (None, False) if portfolio not found or not custom.
    """
    if portfolio_id is None:
        return main_session, False

    result = await main_session.execute(
        select(Portfolio).where(Portfolio.portfolio_id == portfolio_id)
    )
    portfolio = result.scalar_one_or_none()
    if not portfolio or not portfolio.is_custom:
        return main_session, False

    conn_result = await main_session.execute(
        select(CustomPortfolioConnection).where(
            CustomPortfolioConnection.portfolio_id == portfolio_id
        )
    )
    conn = conn_result.scalar_one_or_none()
    if not conn:
        return main_session, False

    custom_session = await get_custom_session(conn)
    return custom_session, True
