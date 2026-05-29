"""Unit tests for risk API endpoints (Section 2.2 Liquidity Safety / Risk Framework)."""

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import get_db
from app.models import Portfolio


class TestPoolHealthEndpoint:
    """Tests for GET /api/v1/risk/pool-health."""

    @pytest.mark.asyncio
    async def test_pool_health_returns_gauge(self, async_client, sample_portfolios):
        """Pool Health Index should be returned as gauge (0-100)."""
        response = await async_client.get("/api/v1/risk/pool-health")

        assert response.status_code == 200
        data = response.json()

        assert "pool_health_index" in data
        assert "global_cash" in data
        assert "total_cash" in data
        assert 0 <= data["pool_health_index"] <= 100

    @pytest.mark.asyncio
    async def test_pool_health_calculation(self, async_client, sample_portfolios):
        """Pool Health Index = (Global Cash / Total Cash) * 100."""
        response = await async_client.get("/api/v1/risk/pool-health")

        data = response.json()

        # 4 portfolios from conftest.py:
        # p1: margin=10000, buffer=5000, available=3000, money_market=1000
        # p2: margin=5000, buffer=2000, available=500, money_market=300
        # p3: margin=8000, buffer=4000, available=0, money_market=0
        # p4: margin=23000, buffer=11000, available=3800, money_market=1600
        # Total margin = 46000, Total buffer = 22000
        # Total available = 7300, Total money_market = 2900
        # Global Cash = 7300 + 2900 = 10200
        # Total Cash = 46000 + 22000 + 7300 + 2900 = 78200
        # Expected Index = (10200 / 78200) * 100 ≈ 13.04

        expected_global = 7300.0 + 2900.0  # 10200
        expected_total = 46000.0 + 22000.0 + 7300.0 + 2900.0  # 78200
        expected_index = (expected_global / expected_total) * 100

        assert abs(data["pool_health_index"] - round(expected_index, 2)) < 0.1
        assert data["global_cash"] == expected_global
        assert data["total_cash"] == expected_total


class TestMoneyReserveStatusEndpoint:
    """Tests for GET /api/v1/risk/money-reserve-status."""

    @pytest.mark.asyncio
    async def test_returns_status_danger_optimal_inefficient(self, async_client, sample_portfolios):
        """Money Reserve Status returns one of: Danger, Optimal, Inefficient."""
        response = await async_client.get("/api/v1/risk/money-reserve-status")

        assert response.status_code == 200
        data = response.json()

        assert data["status"] in ["Danger", "Optimal", "Inefficient"]
        assert "global_cash" in data
        assert "margin_plus_buffer" in data
        assert "lower_bound" in data  # 120%
        assert "upper_bound" in data  # 200%

    @pytest.mark.asyncio
    async def test_danger_when_global_cash_below_120_percent(self, async_client, sample_portfolios):
        """Danger when Global Cash < (Margin + Buffer) * 120%."""
        response = await async_client.get("/api/v1/risk/money-reserve-status")

        data = response.json()

        # 4 portfolios from conftest.py:
        # p1: margin=10000, buffer=5000
        # p2: margin=5000, buffer=2000
        # p3: margin=8000, buffer=4000
        # p4: margin=23000, buffer=11000
        # Total Margin + Buffer = 46000 + 22000 = 68000
        # 120% threshold = 68000 * 1.2 = 81600
        # Global Cash = 10200 (well below 81600)
        # Should be Danger

        margin_plus_buffer = 68000.0
        assert data["status"] == "Danger"
        assert data["lower_bound"] == margin_plus_buffer * 1.2  # 81600

    @pytest.mark.asyncio
    async def test_thresholds_calculation(self, async_client, sample_portfolios):
        """Lower bound = 120%, Upper bound = 200% of (Margin + Buffer)."""
        response = await async_client.get("/api/v1/risk/money-reserve-status")

        data = response.json()

        # 4 portfolios: margin=46000, buffer=22000
        # Total margin_plus_buffer = 68000
        margin_plus_buffer = 68000.0

        assert data["margin_plus_buffer"] == margin_plus_buffer
        assert data["lower_bound"] == margin_plus_buffer * 1.2
        assert data["upper_bound"] == margin_plus_buffer * 2.0


class TestPortfolioSafetyEndpoint:
    """Tests for GET /api/v1/risk/portfolio-safety/{id}."""

    @pytest.mark.asyncio
    async def test_returns_safety_status_for_valid_id(self, async_client, sample_portfolios):
        """Returns Danger/Warning/Safe for valid portfolio ID."""
        response = await async_client.get("/api/v1/risk/portfolio-safety/1")

        assert response.status_code == 200
        data = response.json()

        assert data["safety_status"] in ["Danger", "Warning", "Safe"]
        assert data["portfolio_id"] == 1
        assert "port_cash" in data
        assert "margin_plus_buffer" in data
        assert "threshold_20_percent" in data

    @pytest.mark.asyncio
    async def test_danger_when_port_cash_zero(self, async_client, sample_portfolios):
        """Danger when portfolio available_cash == 0 (portfolio ID 3)."""
        response = await async_client.get("/api/v1/risk/portfolio-safety/3")

        data = response.json()

        assert data["safety_status"] == "Danger"
        assert data["port_cash"] == 0.0

    @pytest.mark.asyncio
    async def test_warning_when_port_cash_below_20_percent(self, async_client, sample_portfolios):
        """Warning when Port Cash < 20% of (Port Margin + Port Buffer)."""
        # Portfolio 2: margin=5000, buffer=2000, available=500, money_market=300
        # Port Cash = 800, Margin+Buffer = 7000, 20% threshold = 1400
        # 800 < 1400 -> Warning
        response = await async_client.get("/api/v1/risk/portfolio-safety/2")

        data = response.json()

        assert data["safety_status"] == "Warning"
        assert data["port_cash"] == 800.0
        assert data["threshold_20_percent"] == 1400.0

    @pytest.mark.asyncio
    async def test_safe_when_port_cash_above_threshold(self, async_client, sample_portfolios):
        """Safe when Port Cash >= 20% of (Port Margin + Port Buffer)."""
        # Portfolio 1: margin=10000, buffer=5000, available=3000, money_market=1000
        # Port Cash = 4000, Margin+Buffer = 15000, 20% threshold = 3000
        # 4000 >= 3000 -> Safe
        response = await async_client.get("/api/v1/risk/portfolio-safety/1")

        data = response.json()

        assert data["safety_status"] == "Safe"
        assert data["port_cash"] == 4000.0
        assert data["threshold_20_percent"] == 3000.0

    @pytest.mark.asyncio
    async def test_returns_404_for_invalid_id(self, async_client, sample_portfolios):
        """Returns 404 for non-existent portfolio ID."""
        response = await async_client.get("/api/v1/risk/portfolio-safety/999")

        assert response.status_code == 404
        assert response.json()["detail"] == "Portfolio not found"
