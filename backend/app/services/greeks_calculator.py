"""
Greeks Calculation Module using mibian library.
Provides IV (Implied Volatility) and Greeks calculation for options.
"""

try:
    from decimal import Decimal
    import mibian
except ImportError:
    import subprocess
    import sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "mibian"])
    from decimal import Decimal
    import mibian


def calculate_greeks(
    underlying_price: float,
    strike_price: float,
    interest_rate: float,
    days_to_expiry: int,
    option_price: float,
    call_put: str = "Call"
) -> dict:
    """
    Calculate option Greeks using mibian library.
    
    Args:
        underlying_price: Current price of underlying asset
        strike_price: Option strike price
        interest_rate: Risk-free interest rate as percentage (e.g., 2.5 for 2.5%)
        days_to_expiry: Days until option expiration
        option_price: Option premium price
        call_put: "Call" or "Put"
    
    Returns:
        Dictionary with price, IV, delta, theta, gamma, vega, rho
    """
    try:
        # mibian expects values in specific formats
        underlying = float(underlying_price)
        strike = float(strike_price)
        rate = float(interest_rate)
        days = int(days_to_expiry)
        price = float(option_price)
        
        if call_put.lower() == "call":
            result = mibian.BS(
                [underlying, strike, rate, days],
                call=price
            )
        else:
            result = mibian.BS(
                [underlying, strike, rate, days],
                put=price
            )
        
        return {
            "price": result.price,
            "IV": result.impliedVol,
            "delta": result.delta,
            "theta": result.theta,
            "gamma": result.gamma,
            "vega": result.vega,
            "rho": result.rho
        }
    except Exception as e:
        return {
            "error": str(e),
            "price": None,
            "IV": None,
            "delta": None,
            "theta": None,
            "gamma": None,
            "vega": None,
            "rho": None
        }


def calculate_iv(
    underlying_price: float,
    strike_price: float,
    interest_rate: float,
    days_to_expiry: int,
    option_price: float,
    call_put: str = "Call"
) -> float:
    """
    Calculate Implied Volatility only.
    """
    greeks = calculate_greeks(
        underlying_price, strike_price, interest_rate,
        days_to_expiry, option_price, call_put
    )
    return greeks.get("IV")


class GreeksCalculator:
    """Service class for Greeks calculations."""
    
    def __init__(self, default_interest_rate: float = 2.5):
        self.default_interest_rate = default_interest_rate
    
    def calculate_for_option(
        self,
        option_id: int,
        db_session,
        underlying_price: float,
        interest_rate: float = None
    ) -> dict:
        """
        Calculate and store Greeks for an option record.
        """
        from app.models import OptionDetails
        from datetime import datetime, date
        
        # Get option details
        option = db_session.query(OptionDetails).filter(
            OptionDetails.option_id == option_id
        ).first()
        
        if not option or not option.expiry_date or not option.premium_entry:
            return {"error": "Option not found or missing required fields"}
        
        # Calculate days to expiry
        today = date.today()
        expiry = option.expiry_date if isinstance(option.expiry_date, date) else option.expiry_date.date()
        days_to_expiry = (expiry - today).days
        
        if days_to_expiry <= 0:
            return {"error": "Option expired"}
        
        rate = interest_rate or self.default_interest_rate
        
        try:
            # Calculate Greeks
            underlying = float(underlying_price)
            greeks = calculate_greeks(
                underlying,
                float(option.strike_price or 0),
                rate,
                days_to_expiry,
                float(option.premium_entry),
                option.option_type or "Call"
            )
            
            # Update option record
            option.IV_at_entry = Decimal(str(greeks["IV"])) if greeks.get("IV") else None
            option.delta_at_entry = Decimal(str(greeks["delta"])) if greeks.get("delta") else None
            option.theta = Decimal(str(greeks["theta"])) if greeks.get("theta") else None
            option.gamma = Decimal(str(greeks["gamma"])) if greeks.get("gamma") else None
            option.vega = Decimal(str(greeks["vega"])) if greeks.get("vega") else None
            option.rho = Decimal(str(greeks["rho"])) if greeks.get("rho") else None
            option.underlying_price = Decimal(str(underlying_price))
            
            return greeks
            
        except Exception as e:
            return {"error": str(e)}