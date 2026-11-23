"""Unit tests for the custom-engine cache eviction helper (no live database)."""

from datetime import datetime

from app import database


class FakeEngine:
    """Minimal AsyncEngine stand-in that records disposal."""

    def __init__(self) -> None:
        self.disposed = False

    async def dispose(self) -> None:
        self.disposed = True


async def test_evict_disposes_and_forgets_cached_engine():
    portfolio_id = 987654
    engine = FakeEngine()
    database.CUSTOM_ENGINES[portfolio_id] = (engine, datetime.utcnow())
    database.CUSTOM_INITIALIZED.add(portfolio_id)

    await database.evict_custom_engine(portfolio_id)

    assert portfolio_id not in database.CUSTOM_ENGINES
    assert portfolio_id not in database.CUSTOM_INITIALIZED
    assert engine.disposed is True


async def test_evict_is_a_no_op_for_an_absent_engine():
    portfolio_id = 987655
    assert portfolio_id not in database.CUSTOM_ENGINES

    await database.evict_custom_engine(portfolio_id)

    assert portfolio_id not in database.CUSTOM_ENGINES
    assert portfolio_id not in database.CUSTOM_INITIALIZED
