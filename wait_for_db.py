import asyncio
import os
import sys
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.exc import OperationalError

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://dashboard:dashboard@localhost:5432/investment_main"
)

async def wait_for_db():
    engine = create_async_engine(DATABASE_URL, echo=False, future=True)
    for i in range(10):
        try:
            async with engine.begin() as conn:
                await conn.run_sync(lambda sync_conn: None)
            print("Database is ready!")
            await engine.dispose()
            return True
        except Exception as e:
            print(f"Attempt {i+1}: Database not ready yet: {e}")
            await asyncio.sleep(2)
    print("Database did not become ready after 10 attempts.")
    await engine.dispose()
    return False

if __name__ == "__main__":
    success = asyncio.run(wait_for_db())
    sys.exit(0 if success else 1)