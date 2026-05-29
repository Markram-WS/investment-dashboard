import pytest
from decimal import Decimal


class TestRebalanceModes:
    """Tests for GET /api/v1/rebalance/modes endpoint."""
    
    @pytest.mark.asyncio
    async def test_get_modes_returns_200(self, async_client):
        """Should return 200 with list of modes."""
        response = await async_client.get("/api/v1/rebalance/modes")
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_get_modes_returns_standard_mode(self, async_client):
        """Should return standard mode with correct description."""
        response = await async_client.get("/api/v1/rebalance/modes")
        modes = response.json()
        
        standard_mode = next((m for m in modes if m["mode"] == "standard"), None)
        assert standard_mode is not None
        assert standard_mode["description"] == "Adjust according to fixed target ratio percentages"
    
    @pytest.mark.asyncio
    async def test_get_modes_returns_sigma_weighted_mode(self, async_client):
        """Should return sigma_weighted mode with sigma_window_days."""
        response = await async_client.get("/api/v1/rebalance/modes")
        modes = response.json()
        
        sigma_mode = next((m for m in modes if m["mode"] == "sigma_weighted"), None)
        assert sigma_mode is not None
        assert sigma_mode["description"] == "Calculate weights based on asset volatility (sigma)"
        assert sigma_mode["default_sigma_window_days"] == 30


class TestRebalanceCalculate:
    """Tests for POST /api/v1/rebalance/calculate endpoint."""
    
    @pytest.mark.asyncio
    async def test_calculate_standard_mode(self, async_client, sample_portfolios):
        """Should calculate rebalance in standard mode."""
        portfolio = sample_portfolios[0]  # Safe Portfolio
        
        response = await async_client.post(
            "/api/v1/rebalance/calculate",
            json={
                "portfolio_id": portfolio.portfolio_id,
                "mode": "standard"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["mode"] == "standard"
        assert data["portfolio_id"] == portfolio.portfolio_id
    
    @pytest.mark.asyncio
    async def test_calculate_sigma_weighted_mode(self, async_client, sample_portfolios):
        """Should calculate rebalance in sigma_weighted mode."""
        portfolio = sample_portfolios[0]
        
        response = await async_client.post(
            "/api/v1/rebalance/calculate",
            json={
                "portfolio_id": portfolio.portfolio_id,
                "mode": "sigma_weighted",
                "sigma_window_days": 30
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["mode"] == "sigma_weighted"
    
    @pytest.mark.asyncio
    async def test_calculate_nonexistent_portfolio_returns_404(self, async_client):
        """Should return 404 for non-existent portfolio."""
        response = await async_client.post(
            "/api/v1/rebalance/calculate",
            json={
                "portfolio_id": 99999,
                "mode": "standard"
            }
        )
        
        assert response.status_code == 404
        assert response.json()["detail"] == "Portfolio not found"
    
    @pytest.mark.asyncio
    async def test_calculate_invalid_mode_returns_400(self, async_client, sample_portfolios):
        """Should return 400 for invalid mode."""
        portfolio = sample_portfolios[0]
        
        response = await async_client.post(
            "/api/v1/rebalance/calculate",
            json={
                "portfolio_id": portfolio.portfolio_id,
                "mode": "invalid_mode"
            }
        )
        
        assert response.status_code == 400