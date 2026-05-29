from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from app.models import Base  # Import Base from models
import os

# Database URLs from environment
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://dashboard:dashboard@localhost:5432/investment_main"
)
AI_DATABASE_URL = os.getenv(
    "AI_DATABASE_URL",
    "postgresql+asyncpg://dashboard:dashboard@localhost:5433/investment_ai"
)

# Engines
engine = create_async_engine(DATABASE_URL, echo=False, future=True)
ai_engine = create_async_engine(AI_DATABASE_URL, echo=False, future=True)

# Session makers
AsyncSessionLocal = sessionmaker(
    bind=engine, class_=AsyncSession, expire_on_commit=False
)
AIAsyncSessionLocal = sessionmaker(
    bind=ai_engine, class_=AsyncSession, expire_on_commit=False
)

# Dependency
async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session

async def get_ai_db() -> AsyncSession:
    async with AIAsyncSessionLocal() as session:
        yield session

# Base for models (already defined in models.py, but we keep for reference)
# Base = declarative_base()