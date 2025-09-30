"""Utility helpers for working with Upstash Redis."""
from __future__ import annotations

import asyncio
from functools import lru_cache
from typing import Optional

import structlog
from upstash_redis import Redis

from app.core.config import get_settings

logger = structlog.get_logger(__name__)


def _get_upstash_credentials(read_only: bool) -> Optional[tuple[str, str]]:
    """Return the configured Upstash credentials for the requested access level."""
    settings = get_settings()

    url = settings.UPSTASH_REDIS_REST_URL
    if not url:
        logger.debug("Upstash Redis URL not configured")
        return None

    if read_only:
        token = settings.UPSTASH_REDIS_REST_READONLY_TOKEN or settings.UPSTASH_REDIS_REST_TOKEN
    else:
        token = settings.UPSTASH_REDIS_REST_TOKEN

    if not token:
        logger.debug("Upstash Redis token not configured", read_only=read_only)
        return None

    return url, token


@lru_cache(maxsize=2)
def get_upstash_redis_client(read_only: bool = False) -> Optional[Redis]:
    """Create (and cache) an Upstash Redis client.

    Parameters
    ----------
    read_only:
        When ``True`` use the read-only API token if available. Falls back to the
        read/write token when a dedicated read-only credential has not been
        provided.
    """

    credentials = _get_upstash_credentials(read_only)
    if credentials is None:
        return None

    url, token = credentials
    logger.info("Initialising Upstash Redis client", read_only=read_only)
    return Redis(url=url, token=token)


async def flush_upstash_database() -> Optional[bool]:
    """Flush the configured Upstash Redis database if credentials are present."""
    client = get_upstash_redis_client(read_only=False)
    if client is None:
        return None

    try:
        await asyncio.to_thread(client.flushdb)
        return True
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.warning("Failed to flush Upstash Redis database", error=str(exc))
        return False


def reset_upstash_client_cache() -> None:
    """Reset cached Upstash clients (useful for tests)."""
    get_upstash_redis_client.cache_clear()
