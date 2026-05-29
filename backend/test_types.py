"""Quick test for portfolio types endpoint."""
from app.routers.portfolios import PORTFOLIO_TYPES
import json

print('Portfolio Types:')
print(json.dumps([p.model_dump() for p in PORTFOLIO_TYPES], indent=2, ensure_ascii=False))

# Verify all three types are present
assert len(PORTFOLIO_TYPES) == 3
type_names = [p.type_name for p in PORTFOLIO_TYPES]
assert "Managed Fund" in type_names
assert "Active Trading" in type_names
assert "Spread Strategy" in type_names

# Verify logic matches requirements
for ptype in PORTFOLIO_TYPES:
    assert "type_name" in ptype.model_fields
    assert "description" in ptype.model_fields
    assert "logic" in ptype.model_fields

print("\n✓ All assertions passed!")