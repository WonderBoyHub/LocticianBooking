"""Database configuration and session management."""
import asyncio
import ssl
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from urllib.parse import urlparse

import structlog
from sqlalchemy import event, pool
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

logger = structlog.get_logger(__name__)


class Base(DeclarativeBase):
    """Base class for all database models."""

    pass


# Configure TLS when talking to remote hosts such as Neon
_db_url = urlparse(settings.DATABASE_URL)
_connect_args = {
    "server_settings": {
        "jit": "off",
        "log_statement": "none",
        "application_name": f"jli_loctician_{settings.ENVIRONMENT}",
    },
    "command_timeout": 60,
}

if _db_url.hostname and _db_url.hostname not in {"localhost", "127.0.0.1"}:
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = True
    ssl_context.verify_mode = ssl.CERT_REQUIRED
    _connect_args["ssl"] = ssl_context

# Create async engine with optimized connection pooling
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    # Optimized pool settings for production
    pool_size=10,  # Reduced from 20 for better resource management
    max_overflow=20,  # Allow overflow connections
    pool_pre_ping=True,  # Test connections before use
    pool_recycle=3600,  # Recycle connections every hour
    pool_timeout=30,  # Timeout for getting connection from pool
    connect_args=_connect_args,
    # Performance optimizations
    future=True,  # Use SQLAlchemy 2.0 style
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


@event.listens_for(engine.sync_engine, "connect")
def set_postgresql_params(dbapi_connection, connection_record):
    """Set PostgreSQL-specific connection parameters for optimal performance."""
    if "postgresql" in str(dbapi_connection):
        with dbapi_connection.cursor() as cursor:
            # Performance optimizations
            cursor.execute("SET jit = off")  # Disable JIT for consistency
            cursor.execute("SET work_mem = '64MB'")  # Optimized for typical workload
            cursor.execute("SET maintenance_work_mem = '256MB'")
            cursor.execute("SET effective_cache_size = '1GB'")
            cursor.execute("SET random_page_cost = 1.1")  # SSD optimization
            cursor.execute("SET seq_page_cost = 1.0")

            # Connection and timeout settings
            cursor.execute("SET statement_timeout = '60s'")
            cursor.execute("SET lock_timeout = '30s'")
            cursor.execute("SET idle_in_transaction_session_timeout = '300s'")

            # Application settings
            cursor.execute(f"SET timezone = '{settings.DEFAULT_TIMEZONE}'")
            cursor.execute("SET DateStyle = 'ISO, DMY'")  # Danish date format
            cursor.execute("SET lc_time = 'da_DK.UTF-8'")  # Danish locale for time

            # Security and audit
            cursor.execute("SET log_statement = 'none'")  # Reduce log noise
            cursor.execute("SET log_min_duration_statement = 1000")  # Log slow queries


@asynccontextmanager
async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Get async database session with proper error handling.

    Yields:
        AsyncSession: Database session
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception as e:
            await session.rollback()
            logger.error("Database session error", error=str(e))
            raise
        finally:
            await session.close()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency for FastAPI to get database session.

    Yields:
        AsyncSession: Database session
    """
    async with get_db_session() as session:
        yield session


async def init_db() -> None:
    """Initialize database with tables."""
    try:
        async with engine.begin() as conn:
            # Import all models to ensure they are registered
            from app.models import (  # noqa: F401
                audit,
                availability,
                booking,
                calendar_event,
                cms,
                email_template,
                instagram,
                media,
                product,
                service,
                user,
            )

            # Create all tables
            await conn.run_sync(Base.metadata.create_all)
            logger.info("Database tables created successfully")
    except Exception as exc:  # pragma: no cover - connection failures handled at runtime
        error_message = str(exc)
        logger.error("Database initialization failed", error=error_message)

        guidance = (
            "Check that the PostgreSQL server is running, the DATABASE_URL is correct, and "
            "the configured role/database exist."
        )

        if "does not exist" in error_message and "role" in error_message:
            guidance = (
                "Database role missing. Create the role and database with:\n"
                "  CREATE ROLE loctician_user WITH LOGIN PASSWORD 'your-password';\n"
                "  CREATE DATABASE loctician_booking OWNER loctician_user;\n"
            )

        raise RuntimeError(f"{error_message}\n{guidance}") from exc


async def close_db() -> None:
    """Close database connections."""
    await engine.dispose()
    logger.info("Database connections closed")


class DatabaseHealthCheck:
    """Database health check utility."""

    @staticmethod
    async def check() -> bool:
        """
        Check database connectivity.

        Returns:
            bool: True if database is healthy
        """
        try:
            from sqlalchemy import text
            async with get_db_session() as session:
                result = await session.execute(text("SELECT 1"))
                return result.scalar() == 1
        except Exception as e:
            logger.error("Database health check failed", error=str(e))
            return False


# Create health check instance
db_health = DatabaseHealthCheck()
