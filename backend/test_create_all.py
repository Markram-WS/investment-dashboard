import os
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.models import Base

async def test():
    url = os.environ['DATABASE_URL']
    print(f'URL: {url}')
    engine = create_async_engine(url, echo=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print('Tables created')
    tables = await conn.run_sync(lambda sync_conn: Base.metadata.tables.keys())
    print(f'Tables: {list(tables)}')

asyncio.run(test())
