import pytest
from httpx import AsyncClient
from app.main import app
from app.database import get_db, get_ai_db
from unittest.mock import AsyncMock, patch


class TestAIMarketScan:
    """Tests for POST /api/v1/ai/scan endpoint - Section 4.2.1"""

    @pytest.mark.asyncio
    async def test_market_scan_success(self, async_client: AsyncClient, sample_portfolios):
        """Test successful market scan"""
        payload = {
            "portfolio_id": 1,
            "watchlist_tickers": ["AAPL", "MSFT"],
            "scan_depth": 2
        }
        response = await async_client.post("/api/v1/ai/scan", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "scan_id" in data
        assert data["portfolio_id"] == 1
        assert len(data["results"]) > 0

    @pytest.mark.asyncio
    async def test_market_scan_portfolio_not_found(self, async_client: AsyncClient, sample_portfolios):
        """Test market scan with non-existent portfolio"""
        payload = {
            "portfolio_id": 9999,
            "watchlist_tickers": ["AAPL"]
        }
        response = await async_client.post("/api/v1/ai/scan", json=payload)
        assert response.status_code == 404


class TestAIStrategyPlan:
    """Tests for POST /api/v1/ai/plan endpoint - Section 4.2.2"""

    @pytest.mark.asyncio
    async def test_strategy_plan_success(self, async_client: AsyncClient, sample_portfolios):
        """Test successful strategy planning"""
        payload = {
            "portfolio_id": 1,
            "scan_id": "test-scan-123",
            "max_plans": 3
        }
        response = await async_client.post("/api/v1/ai/plan", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "plan_id" in data
        assert data["portfolio_id"] == 1
        assert len(data["trade_plans"]) > 0

    @pytest.mark.asyncio
    async def test_strategy_plan_portfolio_not_found(self, async_client: AsyncClient, sample_portfolios):
        """Test strategy planning with non-existent portfolio"""
        payload = {
            "portfolio_id": 9999,
            "scan_id": "test-scan-123"
        }
        response = await async_client.post("/api/v1/ai/plan", json=payload)
        assert response.status_code == 404


class TestAIAutonomousExecute:
    """Tests for POST /api/v1/ai/execute endpoint - Section 4.2.3"""

    @pytest.mark.asyncio
    async def test_execute_success(self, async_client: AsyncClient, sample_portfolios):
        """Test successful autonomous execution"""
        payload = {
            "portfolio_id": 1,
            "plan_id": "test-plan-123",
            "mode": "paper",
            "max_orders": 5
        }
        response = await async_client.post("/api/v1/ai/execute", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "execution_id" in data
        assert data["portfolio_id"] == 1

    @pytest.mark.asyncio
    async def test_execute_portfolio_not_found(self, async_client: AsyncClient, sample_portfolios):
        """Test execution with non-existent portfolio"""
        payload = {
            "portfolio_id": 9999,
            "plan_id": "test-plan-123"
        }
        response = await async_client.post("/api/v1/ai/execute", json=payload)
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_execute_insufficient_cash(self, async_client: AsyncClient, sample_portfolios):
        """Test execution with insufficient cash"""
        # This would require setting up a portfolio with low cash
        pass


class TestAIEmergencyStop:
    """Tests for POST /api/v1/ai/emergency-stop endpoint - Section 4.2.4"""

    @pytest.mark.asyncio
    async def test_emergency_stop_success(self, async_client: AsyncClient, sample_portfolios):
        """Test successful emergency stop"""
        payload = {
            "portfolio_id": 1,
            "reason": "Market volatility spike",
            "manual_override": True
        }
        response = await async_client.post("/api/v1/ai/emergency-stop", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "stop_id" in data
        assert data["reason"] == "Market volatility spike"
        assert data["ai_status"] == "paused"

    @pytest.mark.asyncio
    async def test_emergency_stop_all_portfolios(self, async_client: AsyncClient, sample_portfolios):
        """Test emergency stop for all AI portfolios"""
        payload = {
            "reason": "System-wide emergency",
            "manual_override": True
        }
        response = await async_client.post("/api/v1/ai/emergency-stop", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["portfolio_id"] is None


class TestAIResume:
    """Tests for POST /api/v1/ai/resume endpoint"""

    @pytest.mark.asyncio
    async def test_resume_ai_success(self, async_client: AsyncClient, sample_portfolios):
        """Test successful AI resume"""
        response = await async_client.post("/api/v1/ai/resume?portfolio_id=1")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "resumed"


class TestAIStatus:
    """Tests for GET /api/v1/ai/status endpoint"""

    @pytest.mark.asyncio
    async def test_ai_status_success(self, async_client: AsyncClient, sample_portfolios):
        """Test successful AI status retrieval"""
        response = await async_client.get("/api/v1/ai/status?portfolio_id=1")
        assert response.status_code == 200
        data = response.json()
        assert "agents" in data
        assert "active_orders" in data