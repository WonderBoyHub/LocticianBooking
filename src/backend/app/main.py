"""Compatibility module exposing the FastAPI app instance for tests."""
from main import app  # noqa: F401

__all__ = ["app"]
