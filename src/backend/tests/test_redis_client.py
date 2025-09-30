"""Tests for the Upstash Redis helper utilities."""
from typing import Optional

from upstash_redis import Redis

from app.core import config
from app.core.redis_client import (
    get_upstash_redis_client,
    reset_upstash_client_cache,
)


def _reset_settings_cache() -> None:
    config.get_settings.cache_clear()


def test_get_upstash_redis_client_returns_none_when_not_configured() -> None:
    """Without credentials no client should be initialised."""
    reset_upstash_client_cache()
    _reset_settings_cache()

    client = get_upstash_redis_client()

    assert client is None


def test_get_upstash_redis_client_uses_configuration(monkeypatch) -> None:
    """When credentials are provided a Redis client instance is returned."""
    monkeypatch.setenv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io")
    monkeypatch.setenv("UPSTASH_REDIS_REST_TOKEN", "test-token")
    reset_upstash_client_cache()
    _reset_settings_cache()

    client: Optional[Redis] = get_upstash_redis_client()

    assert client is not None
    assert isinstance(client, Redis)


def test_get_upstash_read_only_falls_back_to_write_token(monkeypatch) -> None:
    """Read-only requests fall back to the primary token if a dedicated one is absent."""
    monkeypatch.setenv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io")
    monkeypatch.setenv("UPSTASH_REDIS_REST_TOKEN", "test-token")
    monkeypatch.delenv("UPSTASH_REDIS_REST_READONLY_TOKEN", raising=False)
    reset_upstash_client_cache()
    _reset_settings_cache()

    client = get_upstash_redis_client(read_only=True)

    assert client is not None
    assert isinstance(client, Redis)
