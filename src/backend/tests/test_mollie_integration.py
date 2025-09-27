"""
Comprehensive test suite for Mollie payment integration.
Tests the complete payment flow including webhooks, subscriptions, and error handling.
"""
import asyncio
import json
import pytest
from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, patch, MagicMock
from uuid import uuid4

from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.core.database import get_db
from app.services.mollie_service import mollie_service, MollieAPIError
from app.schemas.mollie_payment import (
    MolliePaymentCreate,
    MolliePaymentResponse,
    MollieAmount,
    MollieCustomerCreate,
    MollieCustomerResponse,
    MollieSubscriptionCreate,
    MollieSubscriptionResponse,
)


@pytest.fixture
def client():
    """Test client fixture."""
    return TestClient(app)


@pytest.fixture
def mock_db():
    """Mock database session."""
    db = AsyncMock(spec=AsyncSession)
    return db


@pytest.fixture
def test_user_id():
    """Test user ID."""
    return uuid4()


@pytest.fixture
def test_plan_id():
    """Test plan ID."""
    return uuid4()


@pytest.fixture
def mock_mollie_payment():
    """Mock Mollie payment response."""
    return MolliePaymentResponse(
        resource="payment",
        id="tr_WDqYK6vllg",
        mode="test",
        createdAt=datetime.utcnow(),
        status="open",
        isCancelable=True,
        amount=MollieAmount(currency="DKK", value="299.00"),
        description="Test subscription payment",
        redirectUrl="https://example.com/success",
        webhookUrl="https://example.com/webhook",
        profileId="pfl_QkEhN94Ba",
        _links={
            "self": {"href": "https://api.mollie.com/v2/payments/tr_WDqYK6vllg"},
            "checkout": {"href": "https://www.mollie.com/payscreen/select-method/WDqYK6vllg"},
            "dashboard": {"href": "https://www.mollie.com/dashboard/org_12345678/payments/tr_WDqYK6vllg"}
        }
    )


@pytest.fixture
def mock_mollie_customer():
    """Mock Mollie customer response."""
    return MollieCustomerResponse(
        resource="customer",
        id="cst_8wmqcHMN4U",
        mode="test",
        name="John Doe",
        email="john@example.com",
        locale="da_DK",
        metadata={"user_id": str(uuid4())},
        createdAt=datetime.utcnow(),
        _links={"self": {"href": "https://api.mollie.com/v2/customers/cst_8wmqcHMN4U"}}
    )


@pytest.fixture
def mock_mollie_subscription():
    """Mock Mollie subscription response."""
    return MollieSubscriptionResponse(
        resource="subscription",
        id="sub_rVKGtNd6s3",
        mode="test",
        createdAt=datetime.utcnow(),
        status="active",
        amount=MollieAmount(currency="DKK", value="299.00"),
        interval="1 month",
        description="Test subscription",
        customerId="cst_8wmqcHMN4U",
        _links={"self": {"href": "https://api.mollie.com/v2/customers/cst_8wmqcHMN4U/subscriptions/sub_rVKGtNd6s3"}}
    )


class TestMollieService:
    """Test Mollie service functionality."""

    @pytest.mark.asyncio
    async def test_create_payment_success(self, mock_mollie_payment):
        """Test successful payment creation."""
        with patch.object(mollie_service, '_make_request') as mock_request:
            mock_request.return_value = mock_mollie_payment.dict()

            payment_data = MolliePaymentCreate(
                amount=MollieAmount(currency="DKK", value="299.00"),
                description="Test payment",
                redirectUrl="https://example.com/success",
                webhookUrl="https://example.com/webhook"
            )

            result = await mollie_service.create_payment(payment_data)

            assert result.id == "tr_WDqYK6vllg"
            assert result.status == "open"
            assert result.amount.value == "299.00"
            mock_request.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_payment_api_error(self):
        """Test payment creation with API error."""
        with patch.object(mollie_service, '_make_request') as mock_request:
            mock_request.side_effect = MollieAPIError("Invalid amount", 422, "unprocessable_entity")

            payment_data = MolliePaymentCreate(
                amount=MollieAmount(currency="DKK", value="0.00"),  # Invalid amount
                description="Test payment",
                redirectUrl="https://example.com/success",
                webhookUrl="https://example.com/webhook"
            )

            with pytest.raises(MollieAPIError) as exc_info:
                await mollie_service.create_payment(payment_data)

            assert exc_info.value.status_code == 422
            assert "Invalid amount" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_create_customer_success(self, mock_mollie_customer):
        """Test successful customer creation."""
        with patch.object(mollie_service, '_make_request') as mock_request:
            mock_request.return_value = mock_mollie_customer.dict()

            customer_data = MollieCustomerCreate(
                name="John Doe",
                email="john@example.com",
                locale="da_DK"
            )

            result = await mollie_service.create_customer(customer_data)

            assert result.id == "cst_8wmqcHMN4U"
            assert result.name == "John Doe"
            assert result.email == "john@example.com"

    @pytest.mark.asyncio
    async def test_create_subscription_success(self, mock_mollie_subscription):
        """Test successful subscription creation."""
        with patch.object(mollie_service, '_make_request') as mock_request:
            mock_request.return_value = mock_mollie_subscription.dict()

            subscription_data = MollieSubscriptionCreate(
                amount=MollieAmount(currency="DKK", value="299.00"),
                interval="1 month",
                description="Test subscription"
            )

            result = await mollie_service.create_subscription("cst_8wmqcHMN4U", subscription_data)

            assert result.id == "sub_rVKGtNd6s3"
            assert result.status == "active"
            assert result.customerId == "cst_8wmqcHMN4U"

    def test_webhook_signature_verification(self):
        """Test webhook signature verification."""
        # Test with valid signature
        payload = b'{"id": "tr_WDqYK6vllg"}'
        secret = "test_webhook_secret"

        # Mock the webhook secret
        with patch.object(mollie_service, 'webhook_secret', secret):
            import hmac
            import hashlib

            expected_signature = hmac.new(
                secret.encode('utf-8'),
                payload,
                hashlib.sha256
            ).hexdigest()
            signature = f"sha256={expected_signature}"

            is_valid = mollie_service.verify_webhook_signature(payload, signature)
            assert is_valid is True

        # Test with invalid signature
        with patch.object(mollie_service, 'webhook_secret', secret):
            invalid_signature = "sha256=invalid_signature"
            is_valid = mollie_service.verify_webhook_signature(payload, invalid_signature)
            assert is_valid is False

    def test_create_amount(self):
        """Test amount creation utility."""
        amount = mollie_service.create_amount(Decimal("299.99"), "DKK")

        assert amount.currency == "DKK"
        assert amount.value == "299.99"

    def test_get_checkout_url(self, mock_mollie_payment):
        """Test checkout URL extraction."""
        url = mollie_service.get_checkout_url(mock_mollie_payment)

        assert url == "https://www.mollie.com/payscreen/select-method/WDqYK6vllg"


class TestPaymentEndpoints:
    """Test payment API endpoints."""

    def test_create_payment_intent_success(self, client, test_user_id, mock_mollie_payment):
        """Test successful payment intent creation."""
        with patch('app.api.v1.endpoints.payments_mollie.get_current_user') as mock_user:
            with patch('app.api.v1.endpoints.payments_mollie.get_db') as mock_db:
                with patch.object(mollie_service, 'create_payment') as mock_create:
                    # Setup mocks
                    mock_user.return_value.id = test_user_id
                    mock_db.return_value.execute = AsyncMock()
                    mock_db.return_value.commit = AsyncMock()
                    mock_create.return_value = mock_mollie_payment

                    # Test data
                    payment_data = {
                        "amount": 299.00,
                        "currency": "DKK",
                        "description": "Test subscription",
                        "payment_type": "subscription"
                    }

                    response = client.post("/api/v1/payments/create-intent", json=payment_data)

                    assert response.status_code == status.HTTP_201_CREATED
                    data = response.json()
                    assert data["mollie_payment_id"] == "tr_WDqYK6vllg"
                    assert data["checkout_url"] is not None

    def test_create_payment_intent_invalid_amount(self, client):
        """Test payment intent creation with invalid amount."""
        with patch('app.api.v1.endpoints.payments_mollie.get_current_user') as mock_user:
            mock_user.return_value.id = uuid4()

            payment_data = {
                "amount": -100.00,  # Invalid negative amount
                "currency": "DKK",
                "description": "Test payment",
                "payment_type": "booking"
            }

            response = client.post("/api/v1/payments/create-intent", json=payment_data)

            assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_get_payment_status(self, client, test_user_id, mock_mollie_payment):
        """Test payment status retrieval."""
        with patch('app.api.v1.endpoints.payments_mollie.get_current_user') as mock_user:
            with patch('app.api.v1.endpoints.payments_mollie.get_db') as mock_db:
                with patch.object(mollie_service, 'get_payment') as mock_get:
                    # Setup mocks
                    mock_user.return_value.id = test_user_id
                    mock_db.return_value.execute = AsyncMock()
                    mock_db.return_value.commit = AsyncMock()

                    # Mock database result
                    mock_result = MagicMock()
                    mock_result.first.return_value = MagicMock(status="pending")
                    mock_db.return_value.execute.return_value = mock_result

                    # Mock Mollie response
                    mock_get.return_value = mock_mollie_payment

                    response = client.get(f"/api/v1/payments/{mock_mollie_payment.id}")

                    assert response.status_code == status.HTTP_200_OK
                    data = response.json()
                    assert data["id"] == mock_mollie_payment.id
                    assert data["status"] == "open"


class TestSubscriptionEndpoints:
    """Test subscription API endpoints."""

    def test_list_subscription_plans(self, client):
        """Test subscription plans listing."""
        with patch('app.api.v1.endpoints.payments_mollie.get_db') as mock_db:
            # Mock database response
            mock_result = MagicMock()
            mock_result.fetchall.return_value = [
                MagicMock(
                    id=uuid4(),
                    name="Basic",
                    description="Basic plan",
                    tier="basic",
                    price_monthly=299.00,
                    price_yearly=2990.00,
                    currency="DKK",
                    max_bookings_per_month=50,
                    max_staff_members=1,
                    max_services=10,
                    priority_support=False,
                    custom_branding=False,
                    api_access=False,
                    booking_discount_percentage=0,
                    setup_fee=0,
                    trial_period_days=14,
                    features='["Online booking", "Customer management"]',
                    is_active=True,
                    is_featured=False,
                    display_order=1,
                    created_at=datetime.utcnow()
                )
            ]
            mock_db.return_value.execute.return_value = mock_result

            response = client.get("/api/v1/payments/subscriptions/plans")

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert len(data) > 0
            assert data[0]["name"] == "Basic"
            assert data[0]["tier"] == "basic"

    def test_create_subscription_success(self, client, test_user_id, test_plan_id, mock_mollie_customer, mock_mollie_subscription):
        """Test successful subscription creation."""
        with patch('app.api.v1.endpoints.payments_mollie.get_current_user') as mock_user:
            with patch('app.api.v1.endpoints.payments_mollie.get_db') as mock_db:
                with patch.object(mollie_service, 'create_customer') as mock_create_customer:
                    with patch.object(mollie_service, 'create_subscription') as mock_create_sub:
                        # Setup mocks
                        mock_user.return_value.id = test_user_id
                        mock_user.return_value.first_name = "John"
                        mock_user.return_value.last_name = "Doe"
                        mock_user.return_value.email = "john@example.com"

                        # Mock database responses
                        mock_db.return_value.execute = AsyncMock()
                        mock_db.return_value.commit = AsyncMock()
                        mock_db.return_value.scalar = AsyncMock()

                        # Mock no existing subscription
                        mock_existing = MagicMock()
                        mock_existing.scalar.return_value = None
                        mock_db.return_value.execute.return_value = mock_existing

                        # Mock plan data
                        mock_plan = MagicMock()
                        mock_plan.price_monthly = 299.00
                        mock_plan.price_yearly = 2990.00
                        mock_plan.trial_period_days = 14
                        mock_plan_result = MagicMock()
                        mock_plan_result.first.return_value = mock_plan

                        # Setup return values for different queries
                        def mock_execute(*args, **kwargs):
                            query = str(args[0]) if args else ""
                            if "existing_sub" in query or "user_subscriptions" in query:
                                mock_result = MagicMock()
                                mock_result.scalar.return_value = None
                                return mock_result
                            elif "subscription_plans" in query:
                                return mock_plan_result
                            elif "user_payment_customers" in query:
                                mock_result = MagicMock()
                                mock_result.scalar.return_value = None
                                return mock_result
                            elif "subscription_statuses" in query:
                                mock_result = MagicMock()
                                mock_result.scalar.return_value = 1
                                return mock_result
                            elif "INSERT INTO user_subscriptions" in query:
                                mock_result = MagicMock()
                                mock_result.scalar.return_value = uuid4()
                                return mock_result
                            else:
                                return MagicMock()

                        mock_db.return_value.execute.side_effect = mock_execute

                        # Mock Mollie responses
                        mock_create_customer.return_value = mock_mollie_customer
                        mock_create_sub.return_value = mock_mollie_subscription

                        subscription_data = {
                            "plan_id": str(test_plan_id),
                            "billing_period": "monthly"
                        }

                        response = client.post("/api/v1/payments/subscriptions/create", json=subscription_data)

                        assert response.status_code == status.HTTP_201_CREATED
                        data = response.json()
                        assert data["plan_id"] == str(test_plan_id)
                        assert data["billing_period"] == "monthly"

    def test_cancel_subscription(self, client, test_user_id):
        """Test subscription cancellation."""
        subscription_id = uuid4()

        with patch('app.api.v1.endpoints.payments_mollie.get_current_user') as mock_user:
            with patch('app.api.v1.endpoints.payments_mollie.get_db') as mock_db:
                with patch.object(mollie_service, 'cancel_subscription') as mock_cancel:
                    # Setup mocks
                    mock_user.return_value.id = test_user_id

                    # Mock subscription data
                    mock_subscription = MagicMock()
                    mock_subscription.mollie_subscription_id = "sub_rVKGtNd6s3"
                    mock_subscription.mollie_customer_id = "cst_8wmqcHMN4U"
                    mock_sub_result = MagicMock()
                    mock_sub_result.first.return_value = mock_subscription

                    mock_db.return_value.execute = AsyncMock(return_value=mock_sub_result)
                    mock_db.return_value.commit = AsyncMock()

                    response = client.post(f"/api/v1/payments/subscriptions/{subscription_id}/cancel")

                    assert response.status_code == status.HTTP_200_OK
                    mock_cancel.assert_called_once()


class TestWebhookHandling:
    """Test webhook handling functionality."""

    def test_webhook_payment_success(self, client):
        """Test webhook handling for successful payment."""
        with patch('app.api.v1.endpoints.payments_mollie.get_db') as mock_db:
            with patch.object(mollie_service, 'verify_webhook_signature') as mock_verify:
                with patch.object(mollie_service, 'get_payment') as mock_get_payment:
                    # Setup mocks
                    mock_verify.return_value = True
                    mock_db.return_value.execute = AsyncMock()
                    mock_db.return_value.commit = AsyncMock()

                    # Mock payment response
                    mock_payment = MagicMock()
                    mock_payment.status = "paid"
                    mock_get_payment.return_value = mock_payment

                    webhook_data = {"id": "tr_WDqYK6vllg"}

                    response = client.post(
                        "/api/v1/payments/webhook",
                        json=webhook_data,
                        headers={"mollie-signature": "sha256=test_signature"}
                    )

                    assert response.status_code == status.HTTP_200_OK
                    assert response.json() == {"status": "ok"}

    def test_webhook_invalid_signature(self, client):
        """Test webhook handling with invalid signature."""
        with patch.object(mollie_service, 'verify_webhook_signature') as mock_verify:
            mock_verify.return_value = False

            webhook_data = {"id": "tr_WDqYK6vllg"}

            response = client.post(
                "/api/v1/payments/webhook",
                json=webhook_data,
                headers={"mollie-signature": "invalid_signature"}
            )

            assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_webhook_missing_signature(self, client):
        """Test webhook handling with missing signature."""
        webhook_data = {"id": "tr_WDqYK6vllg"}

        response = client.post("/api/v1/payments/webhook", json=webhook_data)

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestErrorHandling:
    """Test error handling scenarios."""

    def test_mollie_api_error_handling(self, client, test_user_id):
        """Test handling of Mollie API errors."""
        with patch('app.api.v1.endpoints.payments_mollie.get_current_user') as mock_user:
            with patch('app.api.v1.endpoints.payments_mollie.get_db') as mock_db:
                with patch.object(mollie_service, 'create_payment') as mock_create:
                    # Setup mocks
                    mock_user.return_value.id = test_user_id
                    mock_db.return_value.execute = AsyncMock()

                    # Mock Mollie API error
                    mock_create.side_effect = MollieAPIError("API limit reached", 429, "rate_limit_exceeded")

                    payment_data = {
                        "amount": 299.00,
                        "currency": "DKK",
                        "description": "Test payment",
                        "payment_type": "booking"
                    }

                    response = client.post("/api/v1/payments/create-intent", json=payment_data)

                    assert response.status_code == status.HTTP_400_BAD_REQUEST
                    assert "API limit reached" in response.json()["detail"]

    def test_database_error_handling(self, client, test_user_id):
        """Test handling of database errors."""
        with patch('app.api.v1.endpoints.payments_mollie.get_current_user') as mock_user:
            with patch('app.api.v1.endpoints.payments_mollie.get_db') as mock_db:
                # Setup mocks
                mock_user.return_value.id = test_user_id
                mock_db.return_value.execute.side_effect = Exception("Database connection failed")

                payment_data = {
                    "amount": 299.00,
                    "currency": "DKK",
                    "description": "Test payment",
                    "payment_type": "booking"
                }

                response = client.post("/api/v1/payments/create-intent", json=payment_data)

                assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR


@pytest.mark.asyncio
async def test_concurrent_payment_processing():
    """Test concurrent payment processing to ensure thread safety."""

    async def create_payment(payment_id: str):
        """Simulate payment creation."""
        with patch.object(mollie_service, '_make_request') as mock_request:
            mock_request.return_value = {
                "id": payment_id,
                "status": "open",
                "amount": {"currency": "DKK", "value": "299.00"},
                "description": "Concurrent test payment",
                "_links": {"checkout": {"href": f"https://checkout.mollie.com/{payment_id}"}}
            }

            payment_data = MolliePaymentCreate(
                amount=MollieAmount(currency="DKK", value="299.00"),
                description=f"Concurrent payment {payment_id}",
                redirectUrl="https://example.com/success",
                webhookUrl="https://example.com/webhook"
            )

            result = await mollie_service.create_payment(payment_data)
            return result.id

    # Create multiple concurrent payments
    tasks = [create_payment(f"tr_test_{i}") for i in range(10)]
    results = await asyncio.gather(*tasks)

    # Verify all payments were created successfully
    assert len(results) == 10
    assert all(result.startswith("tr_test_") for result in results)


class TestHealthCheck:
    """Test health check functionality."""

    def test_payment_health_check_success(self, client):
        """Test successful payment health check."""
        with patch.object(mollie_service, 'get_organization') as mock_org:
            mock_org.return_value = {"name": "Test Organization"}

            response = client.get("/api/v1/payments/health")

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["status"] == "healthy"
            assert data["mollie_connected"] is True

    def test_payment_health_check_failure(self, client):
        """Test payment health check failure."""
        with patch.object(mollie_service, 'get_organization') as mock_org:
            mock_org.side_effect = Exception("API connection failed")

            response = client.get("/api/v1/payments/health")

            assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
            data = response.json()
            assert data["status"] == "unhealthy"
            assert data["mollie_connected"] is False