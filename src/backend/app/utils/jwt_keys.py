"""Utility helpers for working with JWT signing keys and JWKS documents."""
from __future__ import annotations

import base64
from functools import lru_cache
from typing import Any, Dict, Optional

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from app.core.config import settings


class JWKSConfigurationError(RuntimeError):
    """Raised when JWKS generation is not possible due to missing configuration."""


def _base64url_uint(value: int) -> str:
    """Encode an integer as base64url without padding."""
    byte_length = (value.bit_length() + 7) // 8
    value_bytes = value.to_bytes(byte_length, "big")
    return base64.urlsafe_b64encode(value_bytes).rstrip(b"=").decode("ascii")


@lru_cache(maxsize=1)
def get_private_key() -> Optional[Any]:
    """Load the configured private key object, if available."""
    if not settings.JWT_PRIVATE_KEY:
        return None

    return serialization.load_pem_private_key(
        settings.JWT_PRIVATE_KEY.encode("utf-8"),
        password=None,
    )


@lru_cache(maxsize=1)
def get_public_key() -> Optional[Any]:
    """Load the configured public key object, deriving from private key if needed."""
    if settings.JWT_PUBLIC_KEY:
        return serialization.load_pem_public_key(
            settings.JWT_PUBLIC_KEY.encode("utf-8")
        )

    private_key = get_private_key()
    if private_key is None:
        return None

    return private_key.public_key()


def get_public_key_pem() -> Optional[str]:
    """Return the PEM encoded public key."""
    public_key = get_public_key()
    if public_key is None:
        return None

    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )

    return public_pem.decode("utf-8")


def get_signing_key() -> str:
    """Return the key material used for signing JWTs."""
    if settings.JWT_PRIVATE_KEY:
        return settings.JWT_PRIVATE_KEY
    return settings.SECRET_KEY


def get_verification_key() -> str:
    """Return the key material used for verifying JWTs."""
    public_key = get_public_key_pem()
    if public_key:
        return public_key
    return get_signing_key()


def get_jwt_algorithm() -> str:
    """Return the algorithm used for signing JWTs."""
    return settings.jwt_algorithm


def get_jwt_headers() -> Optional[Dict[str, str]]:
    """Return additional headers for JWT tokens."""
    if settings.JWT_PRIVATE_KEY and settings.JWT_KEY_ID:
        return {"kid": settings.JWT_KEY_ID}
    return None


def build_jwks_document() -> Dict[str, Any]:
    """Generate a JWKS document from the configured RSA public key."""
    try:
        public_key = get_public_key()
    except ValueError as exc:
        raise JWKSConfigurationError("Invalid JWT key configuration") from exc

    if public_key is None:
        raise JWKSConfigurationError(
            "JWT public key is not configured. Set JWT_PRIVATE_KEY and/or JWT_PUBLIC_KEY."
        )

    if not isinstance(public_key, rsa.RSAPublicKey):
        raise JWKSConfigurationError("JWKS generation is currently supported only for RSA keys.")

    public_numbers = public_key.public_numbers()

    jwk: Dict[str, Any] = {
        "kty": "RSA",
        "use": "sig",
        "alg": get_jwt_algorithm(),
        "n": _base64url_uint(public_numbers.n),
        "e": _base64url_uint(public_numbers.e),
    }

    if settings.JWT_KEY_ID:
        jwk["kid"] = settings.JWT_KEY_ID

    return {"keys": [jwk]}
