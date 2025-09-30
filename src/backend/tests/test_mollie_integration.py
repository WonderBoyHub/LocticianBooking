"""Focused tests for Mollie integration utilities and endpoint workflows."""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.api.v1.endpoints import payments_mollie
from app.schemas.mollie_payment import (
    MollieAmount,
    MolliePaymentResponse,
    MollieSubscriptionCreate,
    PaymentIntentCreate,
)
from app.services.mollie_service import mollie_service


class FakeResult:
    """Simple result object mimicking SQLAlchemy response helpers."""

    def __init__(self, *, scalar=None, first=None, fetchall=None):
        self._scalar = scalar
        self._first = first
        self._fetchall = fetchall or []

    def scalar(self):
        return self._scalar

    def first(self):
        return self._first

    def fetchall(self):
        return self._fetchall


class FakeSession:
    """Async session stub capturing executed statements."""

    def __init__(self, results: list[FakeResult] | None = None):
        self._results = list(results or [])
        self.executed: list[tuple[str, dict | None]] = []
        self.committed = False
        self.rolled_back = False

    async def execute(self, query, params=None):
        self.executed.append((str(query), params))
        if self._results:
            return self._results.pop(0)
        return FakeResult()

    async def commit(self):
        self.committed = True

    async def rollback(self):
        self.rolled_back = True


def sample_payment_response() -> MolliePaymentResponse:
    """Create a Mollie payment response payload for tests."""
    return MolliePaymentResponse(
        resource="payment",
        id="tr_WDqYK6vllg",
        mode="test",
        createdAt=datetime.now(timezone.utc),
        status="open",
        isCancelable=True,
        amount=MollieAmount(currency="DKK", value="299.00"),
        description="Test payment",
        redirectUrl="https://example.com/success",
        webhookUrl="https://example.com/webhook",
        profileId="pfl_QkEhN94Ba",
        _links={
            "self": {"href": "https://api.mollie.com/v2/payments/tr_WDqYK6vllg"},
            "checkout": {"href": "https://www.mollie.com/payscreen/select-method/WDqYK6vllg"},
        },
    )


def sample_user() -> SimpleNamespace:
    """Create a lightweight user object with required attributes."""
    return SimpleNamespace(
        id=uuid4(),
        first_name="Test",
        last_name="User",
        email="test@example.com",
    )


def test_create_amount_uppercases_currency():
    amount = mollie_service.create_amount(Decimal("199.99"), "dkk")
    assert amount.currency == "DKK"
    assert amount.value == "199.99"


def test_get_checkout_url_handles_dict_links():
    payment = sample_payment_response()
    url = mollie_service.get_checkout_url(payment)
    assert url == "https://www.mollie.com/payscreen/select-method/WDqYK6vllg"


def test_subscription_interval_accepts_singular_form():
    subscription = MollieSubscriptionCreate(
        amount=MollieAmount(currency="DKK", value="100.00"),
        interval="1 month",
        description="Test subscription",
    )
    assert subscription.interval == "1 month"


@pytest.mark.asyncio
async def test_create_payment_intent_persists_record(monkeypatch):
    fake_payment = sample_payment_response()

    monkeypatch.setattr(mollie_service, "validate_payment_amount", lambda amount, currency: True)
    monkeypatch.setattr(mollie_service, "validate_customer_data", lambda email, name: True)

    async def mock_create_payment(payment_data):
        return fake_payment

    monkeypatch.setattr(mollie_service, "create_payment", mock_create_payment)
    monkeypatch.setattr(mollie_service, "get_checkout_url", lambda payment: "https://checkout.example/redirect")

    session = FakeSession()
    payload = PaymentIntentCreate(
        amount=Decimal("299.00"),
        description="New subscription",
        payment_type="subscription",
    )

    result = await payments_mollie.create_payment_intent(payload, sample_user(), session)

    assert result.mollie_payment_id == fake_payment.id
    assert result.checkout_url == "https://checkout.example/redirect"
    assert session.committed is True
    assert any("INSERT INTO payment_intents" in query for query, _ in session.executed)


@pytest.mark.asyncio
async def test_get_payment_status_merges_remote_state(monkeypatch):
    fake_payment = sample_payment_response()

    async def mock_get_payment(payment_id):
        return fake_payment

    monkeypatch.setattr(mollie_service, "get_payment", mock_get_payment)

    db_result = FakeResult(first=SimpleNamespace(status="pending"))
    session = FakeSession(results=[db_result])

    response = await payments_mollie.get_payment_status(fake_payment.id, sample_user(), session)

    assert response["id"] == fake_payment.id
    assert response["status"] == fake_payment.status
    assert session.committed is True


@pytest.mark.asyncio
async def test_list_subscription_plans_parses_features():
    plan_row = SimpleNamespace(
        id=uuid4(),
        name="Basic",
        description="Basic plan",
        tier="basic",
        price_monthly=Decimal("299.00"),
        price_yearly=Decimal("2990.00"),
        currency="DKK",
        max_bookings_per_month=50,
        max_staff_members=1,
        max_services=10,
        priority_support=True,
        custom_branding=False,
        api_access=False,
        booking_discount_percentage=Decimal("0"),
        setup_fee=Decimal("0"),
        trial_days=14,
        mollie_price_id_monthly="price_basic",
        mollie_product_id="prod_basic",
        features='["Online booking"]',
        is_active=True,
        is_featured=False,
        display_order=1,
        created_at=datetime.now(timezone.utc),
    )

    session = FakeSession(results=[FakeResult(fetchall=[plan_row])])

    plans = await payments_mollie.list_subscription_plans(active_only=True, db=session)

    assert len(plans) == 1
    plan = plans[0]
    assert plan.name == "Basic"
    assert plan.features == ["Online booking"]
