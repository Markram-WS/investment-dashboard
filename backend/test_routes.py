"""Test that the API endpoint is correctly registered."""
from app.main import app

# Check routes
routes = []
for route in app.routes:
    if hasattr(route, 'path'):
        routes.append(route.path)

print("Registered routes:")
for r in sorted(set(routes)):
    print(f"  {r}")

# Verify the types endpoint is registered
assert "/api/v1/portfolios/types" in routes, "Endpoint not registered!"
print("\n✓ /api/v1/portfolios/types endpoint is registered!")