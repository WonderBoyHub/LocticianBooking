"""Utility helpers for working with JSON Web Key Sets (JWKS)."""
from __future__ import annotations

import time
from typing import Any, Dict, Optional

import httpx
import structlog


logger = structlog.get_logger(__name__)


class JWKSClientError(Exception):
    """Raised when a JWKS operation fails."""


class JWKSClient:
    """Small helper for downloading and caching JWKS documents."""

    def __init__(self, jwks_url: str, cache_ttl_seconds: int = 300) -> None:
        if not jwks_url:
            raise ValueError("JWKS URL must be provided")

        self._jwks_url = jwks_url
        self._cache_ttl_seconds = cache_ttl_seconds
        self._cached_document: Optional[Dict[str, Any]] = None
        self._cache_expiration: float = 0.0

    def _download_jwks(self) -> Dict[str, Any]:
        """Download the JWKS document from the configured endpoint."""
        try:
            with httpx.Client(timeout=5.0) as client:
                response = client.get(self._jwks_url)
                response.raise_for_status()
                jwks = response.json()
        except (httpx.RequestError, httpx.HTTPStatusError) as exc:
            logger.error("Failed to download JWKS", error=str(exc))
            raise JWKSClientError("Unable to download JWKS document") from exc

        if not isinstance(jwks, dict) or "keys" not in jwks:
            logger.error("Invalid JWKS payload received")
            raise JWKSClientError("JWKS document is not valid")

        keys = jwks.get("keys")
        if not isinstance(keys, list) or not keys:
            logger.error("JWKS payload did not include any signing keys")
            raise JWKSClientError("JWKS does not contain signing keys")

        return jwks

    def _should_refresh(self) -> bool:
        return not self._cached_document or time.time() >= self._cache_expiration

    def get_jwks(self) -> Dict[str, Any]:
        """Return the cached JWKS document, refreshing it when necessary."""
        if self._should_refresh():
            jwks = self._download_jwks()
            self._cached_document = jwks
            self._cache_expiration = time.time() + self._cache_ttl_seconds
        return self._cached_document  # type: ignore[return-value]

    def get_signing_key(self, kid: Optional[str]) -> Dict[str, Any]:
        """Return the signing key that matches the provided key id (kid)."""
        jwks = self.get_jwks()
        keys = jwks.get("keys", [])

        if kid:
            for key in keys:
                if key.get("kid") == kid:
                    return key

        if not kid and len(keys) == 1:
            return keys[0]

        # Attempt a refresh to account for key rotation
        self._cached_document = None
        jwks = self.get_jwks()
        keys = jwks.get("keys", [])

        if kid:
            for key in keys:
                if key.get("kid") == kid:
                    return key

        if not kid and len(keys) == 1:
            return keys[0]

        logger.error("Signing key not found in JWKS", kid=kid)
        raise JWKSClientError("Signing key not found in JWKS")
