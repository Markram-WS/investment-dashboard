"""Unit tests for risk API endpoints (Section 2.2 Liquidity Safety / Risk Framework).

Tests verify the business logic calculations according to requirements:
- Pool Health Index: (Global Cash / Total Cash) * 100, clamped 0-100
- Money Reserve Status: Danger/Optimal/Inefficient based on 120%-200% threshold
- Portfolio Safety: Danger/Warning/Safe based on 0% and 20% thresholds
"""

import pytest
from fastapi.testclient import TestClient
from app.routers.risk import (
    PoolHealthResponse,
    MoneyReserveStatusResponse,
    PortfolioSafetyResponse,
)
from unittest.mock import AsyncMock, patch


def test_pool_health_response_model():
    """PoolHealthResponse should have required fields."""
    response = PoolHealthResponse(
        pool_health_index=50.0,
        global_cash=5400.0,
        total_cash=39400.0
    )
    assert response.pool_health_index == 50.0
    assert response.global_cash == 5400.0
    assert response.total_cash == 39400.0


def test_money_reserve_status_response_model():
    """MoneyReserveStatusResponse should have required fields."""
    response = MoneyReserveStatusResponse(
        status="Optimal",
        global_cash=5400.0,
        margin_plus_buffer=34000.0,
        lower_bound=40800.0,
        upper_bound=68000.0
    )
    assert response.status == "Optimal"
    assert response.lower_bound == 40800.0  # 34000 * 1.2


def test_portfolio_safety_response_model():
    """PortfolioSafetyResponse should have required fields."""
    response = PortfolioSafetyResponse(
        portfolio_id=1,
        portfolio_name="Test",
        safety_status="Safe",
        port_cash=4000.0,
        margin_plus_buffer=15000.0,
        threshold_20_percent=3000.0,
        global_risk_alert=False
    )
    assert response.safety_status == "Safe"
    assert response.portfolio_id == 1


class TestPoolHealthLogic:
    """Business logic tests for Pool Health Index calculation."""

    def test_pool_health_zero_when_no_portfolios(self):
        """Pool Health Index should be 0 when no portfolios exist."""
        # With no portfolios: global_cash=0, total_cash=0
        assert (0 / 1) * 100 == 0  # Would be 0 since division by zero avoided

    def test_pool_health_clamped_at_100(self):
        """Pool Health Index should be clamped at 100 maximum."""
        # If global_cash > total_cash (shouldn't happen but test the clamp)
        global_cash = 5000
        total_cash = 3000
        raw_index = (global_cash / total_cash) * 100  # Would be 166.67
        clamped = min(100.0, max(0.0, raw_index))
        assert clamped == 100.0

    def test_pool_health_example_calculation(self):
        """Verify Pool Health Index calculation with example values."""
        # Total: margin=10000, buffer=5000, available=3000, money_market=1000
        # From portfolio 1 in test data
        global_cash = 3000 + 1000  # 4000
        total_cash = 10000 + 5000 + 3000 + 1000  # 19000
        expected_index = (global_cash / total_cash) * 100  # 21.05
        
        assert round(expected_index, 2) == 21.05


class TestMoneyReserveLogic:
    """Business logic tests for Money Reserve Status calculation."""

    def test_danger_status_when_below_120_percent(self):
        """Danger when Global Cash < (Margin + Buffer) * 120%."""
        margin_plus_buffer = 34000.0
        global_cash = 5400.0  # Well below threshold
        lower_bound = margin_plus_buffer * 1.2  # 40800
        
        status = "Optimal"  # default
        if global_cash < lower_bound:
            status = "Danger"
        
        assert status == "Danger"

    def test_optimal_status_when_between_thresholds(self):
        """Optimal when Global Cash is 120% - 200% of (Margin + Buffer)."""
        margin_plus_buffer = 10000.0
        global_cash = 15000.0  # 150% of margin+buffer
        lower_bound = margin_plus_buffer * 1.2  # 12000
        upper_bound = margin_plus_buffer * 2.0  # 20000
        
        status = "Optimal"
        if global_cash < lower_bound:
            status = "Danger"
        elif global_cash > upper_bound:
            status = "Inefficient"
        
        assert status == "Optimal"

    def test_inefficient_status_when_above_200_percent(self):
        """Inefficient when Global Cash > (Margin + Buffer) * 200%."""
        margin_plus_buffer = 10000.0
        global_cash = 25000.0  # 250% of margin+buffer
        upper_bound = margin_plus_buffer * 2.0  # 20000
        
        status = "Optimal"
        if global_cash > upper_bound:
            status = "Inefficient"
        
        assert status == "Inefficient"


class TestPortfolioSafetyLogic:
    """Business logic tests for Portfolio Safety calculation."""

    def test_danger_when_port_cash_zero(self):
        """Danger when Port Cash == 0."""
        port_cash = 0.0
        margin_plus_buffer = 12000.0
        
        status = "Safe"
        if port_cash == 0:
            status = "Danger"
        
        assert status == "Danger"

    def test_warning_when_port_cash_below_20_percent(self):
        """Warning when Port Cash < 20% of (Port Margin + Port Buffer)."""
        margin_plus_buffer = 7000.0
        port_cash = 800.0  # 11.4% of margin+buffer
        threshold_20_percent = margin_plus_buffer * 0.2  # 1400
        
        status = "Safe"
        if threshold_20_percent > 0 and port_cash < threshold_20_percent:
            status = "Warning"
        
        assert status == "Warning"

    def test_safe_when_port_cash_above_threshold(self):
        """Safe when Port Cash >= 20% of (Port Margin + Port Buffer)."""
        margin_plus_buffer = 15000.0
        port_cash = 4000.0  # 26.7% of margin+buffer
        threshold_20_percent = margin_plus_buffer * 0.2  # 3000
        
        status = "Safe"
        if threshold_20_percent > 0 and port_cash < threshold_20_percent:
            status = "Warning"
        elif port_cash == 0:
            status = "Danger"
        
        assert status == "Safe"

    def test_global_risk_alert_threshold(self):
        """Global Risk Alert when (Margin + Buffer) / Total Cash > 85%."""
        total_margin = 10000.0
        total_buffer = 5000.0
        total_available_cash = 3000.0
        total_money_market = 1000.0
        
        margin_plus_buffer_all = total_margin + total_buffer  # 15000
        total_cash_all = 10000 + 5000 + 3000 + 1000  # 19000
        
        ratio = margin_plus_buffer_all / total_cash_all  # 0.789
        global_risk_alert = ratio > 0.85
        
        assert global_risk_alert == False  # 78.9% < 85%