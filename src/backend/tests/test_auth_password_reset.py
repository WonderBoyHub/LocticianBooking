"""Tests for password reset and recovery endpoints."""

from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch

from app.main import app
from app.core.database import get_db
from app.api.v1.endpoints.auth import rate_limit_check


@pytest.fixture()
def client():
    """Return a test client for the FastAPI app."""

    with patch("main.init_db", AsyncMock()), patch(
        "main.db_health.check", AsyncMock(return_value=True)
    ), patch("main.close_db", AsyncMock()):
        with TestClient(app) as test_client:
            yield test_client


@pytest.fixture()
def db_mock():
    """Create a fresh AsyncSession mock for each test."""

    mock = AsyncMock()
    mock.execute = AsyncMock()
    mock.commit = AsyncMock()
    mock.rollback = AsyncMock()
    return mock


@pytest.fixture(autouse=True)
def override_dependencies(db_mock):
    """Override dependencies used by the password reset endpoints."""

    async def _override_db():
        yield db_mock

    async def _no_rate_limit():
        return None

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[rate_limit_check] = _no_rate_limit

    try:
        yield
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(rate_limit_check, None)


def test_request_password_reset_success(client, db_mock):
    """Ensure requesting a password reset succeeds for existing users."""

    user_id = uuid4()
    fake_user = SimpleNamespace(
        id=str(user_id),
        first_name="Test",
        last_name="User",
        email="test@example.com",
    )

    db_mock.execute.return_value = SimpleNamespace(rowcount=1)

    with patch("app.api.v1.endpoints.auth.auth_service.get_user_by_email", AsyncMock(return_value=fake_user)):
        with patch("app.api.v1.endpoints.auth.auth_service.create_access_token", return_value="token-123"):
            response = client.post(
                "/api/v1/auth/request-password-reset",
                json={"email": fake_user.email},
            )

    assert response.status_code == 200
    assert "reset link" in response.json()["message"].lower()
    db_mock.commit.assert_awaited()


def test_reset_password_happy_path(client, db_mock):
    """Verify that a valid reset token updates the password and clears sessions."""

    db_mock.execute.side_effect = [SimpleNamespace(rowcount=1), SimpleNamespace(rowcount=1)]

    with patch("app.api.v1.endpoints.auth.auth_service.verify_token", return_value={"sub": str(uuid4()), "type": "password_reset"}):
        with patch("app.api.v1.endpoints.auth.auth_service.get_password_hash", return_value="hashed"):
            response = client.post(
                "/api/v1/auth/reset-password",
                json={"token": "valid-token", "new_password": "Secure123", "confirm_password": "Secure123"},
            )

    assert response.status_code == 200
    assert "success" in response.json()["message"].lower()
    assert db_mock.commit.await_count == 1


def test_reset_password_rejects_invalid_token(client, db_mock):
    """An invalid token payload should produce a 400 error."""

    with patch("app.api.v1.endpoints.auth.auth_service.verify_token", return_value={"sub": str(uuid4()), "type": "other"}):
        response = client.post(
            "/api/v1/auth/reset-password",
            json={"token": "bad", "new_password": "Secure123", "confirm_password": "Secure123"},
        )

    assert response.status_code == 400
    body = response.json()
    assert body.get("message", "").lower().startswith("invalid")
