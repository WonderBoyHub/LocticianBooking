"""
Mollie Payment Service
Complete integration with Mollie Payment API for payments and subscriptions.
"""
import hmac
import hashlib
import json
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional

import httpx
import structlog
from fastapi import HTTPException, status

from app.core.config import settings
from app.schemas.mollie_payment import (
    MollieAmount,
    MolliePaymentCreate,
    MolliePaymentResponse,
    MollieCustomerCreate,
    MollieCustomerResponse,
    MollieSubscriptionCreate,
    MollieSubscriptionResponse,
    MollieMandateCreate,
    MollieMandateResponse,
    MollieRefundCreate,
    MollieRefundResponse,
)

logger = structlog.get_logger(__name__)

# Mollie API Configuration
MOLLIE_API_BASE_URL = "https://api.mollie.com/v2"
MOLLIE_API_TIMEOUT = 30  # seconds


class MollieServiceError(Exception):
    """Base exception for Mollie service errors."""
    pass


class MollieAPIError(MollieServiceError):
    """Mollie API specific errors."""
    def __init__(self, message: str, status_code: int, error_type: str = None):
        super().__init__(message)
        self.status_code = status_code
        self.error_type = error_type


class MollieService:
    """
    Comprehensive Mollie payment service.
    Handles payments, subscriptions, customers, mandates, and webhooks.
    """

    def __init__(self, api_key: str = None, webhook_secret: str = None):
        """Initialize Mollie service with API credentials."""
        self.api_key = api_key or getattr(settings, 'MOLLIE_API_KEY', None)
        self.webhook_secret = webhook_secret or getattr(settings, 'MOLLIE_WEBHOOK_SECRET', None)
        self.disabled = False

        if not self.api_key:
            # During local development and automated tests we often do not
            # configure Mollie credentials.  Instead of crashing the whole
            # application we mark the service as disabled and fail lazily when
            # one of the payment operations is invoked.
            logger.warning(
                "Mollie API key is not configured; payment features are disabled."
            )
            self.disabled = True
            self.headers = {}
            self.test_mode = True
            return

        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "User-Agent": f"JLI-BookingSystem/1.0 Python/httpx",
        }

        # Determine if we're in test mode
        self.test_mode = self.api_key.startswith('test_')

        logger.info(
            "Mollie service initialized",
            test_mode=self.test_mode,
            has_webhook_secret=bool(self.webhook_secret)
        )

    def _ensure_configured(self) -> None:
        """Ensure the Mollie service has been configured."""
        if self.disabled:
            raise MollieServiceError(
                "Mollie service is not configured. Set MOLLIE_API_KEY to enable payments."
            )

    async def _make_request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Make authenticated request to Mollie API."""
        self._ensure_configured()
        url = f"{MOLLIE_API_BASE_URL}/{endpoint.lstrip('/')}"

        async with httpx.AsyncClient(timeout=MOLLIE_API_TIMEOUT) as client:
            try:
                logger.debug(
                    "Making Mollie API request",
                    method=method,
                    url=url,
                    has_data=bool(data)
                )

                response = await client.request(
                    method=method,
                    url=url,
                    headers=self.headers,
                    json=data,
                    params=params
                )

                logger.debug(
                    "Mollie API response",
                    status_code=response.status_code,
                    response_size=len(response.content)
                )

                if response.status_code >= 400:
                    error_data = {}
                    try:
                        error_data = response.json()
                    except json.JSONDecodeError:
                        pass

                    error_message = error_data.get('detail', response.text)
                    error_type = error_data.get('type', 'unknown')

                    logger.error(
                        "Mollie API error",
                        status_code=response.status_code,
                        error_message=error_message,
                        error_type=error_type
                    )

                    raise MollieAPIError(
                        message=error_message,
                        status_code=response.status_code,
                        error_type=error_type
                    )

                return response.json()

            except httpx.RequestError as e:
                logger.error("Mollie API request failed", error=str(e))
                raise MollieServiceError(f"Request failed: {str(e)}")
            except json.JSONDecodeError as e:
                logger.error("Invalid JSON response from Mollie", error=str(e))
                raise MollieServiceError("Invalid response format")

    # Payment Operations
    async def create_payment(
        self,
        payment_data: MolliePaymentCreate,
        idempotency_key: Optional[str] = None
    ) -> MolliePaymentResponse:
        """Create a new payment with Mollie."""
        try:
            # Add idempotency header if provided
            headers = self.headers.copy()
            if idempotency_key:
                headers["Idempotency-Key"] = idempotency_key

            logger.info(
                "Creating Mollie payment",
                amount=payment_data.amount.value,
                currency=payment_data.amount.currency,
                description=payment_data.description[:50] + "..." if len(payment_data.description) > 50 else payment_data.description
            )

            response_data = await self._make_request(
                method="POST",
                endpoint="payments",
                data=payment_data.model_dump(exclude_none=True)
            )

            payment_response = MolliePaymentResponse(**response_data)

            links = getattr(payment_response, "_links", None)
            checkout_url = None
            if links:
                checkout = getattr(links, "checkout", None)
                if checkout:
                    if isinstance(checkout, dict):
                        checkout_url = checkout.get("href")
                    else:
                        checkout_url = getattr(checkout, "href", None)
                        if checkout_url is None and hasattr(checkout, "get"):
                            checkout_url = checkout.get("href")

            logger.info(
                "Mollie payment created",
                payment_id=payment_response.id,
                status=payment_response.status,
                checkout_url=checkout_url
            )

            return payment_response

        except MollieAPIError:
            raise
        except Exception as e:
            logger.error("Failed to create Mollie payment", error=str(e))
            raise MollieServiceError(f"Payment creation failed: {str(e)}")

    async def get_payment(self, payment_id: str) -> MolliePaymentResponse:
        """Retrieve payment details from Mollie."""
        try:
            logger.debug("Retrieving Mollie payment", payment_id=payment_id)

            response_data = await self._make_request(
                method="GET",
                endpoint=f"payments/{payment_id}"
            )

            return MolliePaymentResponse(**response_data)

        except MollieAPIError:
            raise
        except Exception as e:
            logger.error("Failed to retrieve Mollie payment", payment_id=payment_id, error=str(e))
            raise MollieServiceError(f"Payment retrieval failed: {str(e)}")

    async def cancel_payment(self, payment_id: str) -> MolliePaymentResponse:
        """Cancel a payment in Mollie."""
        try:
            logger.info("Canceling Mollie payment", payment_id=payment_id)

            response_data = await self._make_request(
                method="DELETE",
                endpoint=f"payments/{payment_id}"
            )

            payment_response = MolliePaymentResponse(**response_data)

            logger.info("Mollie payment canceled", payment_id=payment_id, status=payment_response.status)

            return payment_response

        except MollieAPIError:
            raise
        except Exception as e:
            logger.error("Failed to cancel Mollie payment", payment_id=payment_id, error=str(e))
            raise MollieServiceError(f"Payment cancellation failed: {str(e)}")

    # Customer Operations
    async def create_customer(self, customer_data: MollieCustomerCreate) -> MollieCustomerResponse:
        """Create a customer in Mollie."""
        try:
            logger.info("Creating Mollie customer", email=customer_data.email)

            response_data = await self._make_request(
                method="POST",
                endpoint="customers",
                data=customer_data.model_dump(exclude_none=True)
            )

            customer_response = MollieCustomerResponse(**response_data)

            logger.info("Mollie customer created", customer_id=customer_response.id)

            return customer_response

        except MollieAPIError:
            raise
        except Exception as e:
            logger.error("Failed to create Mollie customer", error=str(e))
            raise MollieServiceError(f"Customer creation failed: {str(e)}")

    async def get_customer(self, customer_id: str) -> MollieCustomerResponse:
        """Retrieve customer details from Mollie."""
        try:
            response_data = await self._make_request(
                method="GET",
                endpoint=f"customers/{customer_id}"
            )

            return MollieCustomerResponse(**response_data)

        except MollieAPIError:
            raise
        except Exception as e:
            logger.error("Failed to retrieve Mollie customer", customer_id=customer_id, error=str(e))
            raise MollieServiceError(f"Customer retrieval failed: {str(e)}")

    async def update_customer(
        self,
        customer_id: str,
        customer_data: MollieCustomerCreate
    ) -> MollieCustomerResponse:
        """Update customer details in Mollie."""
        try:
            logger.info("Updating Mollie customer", customer_id=customer_id)

            response_data = await self._make_request(
                method="PATCH",
                endpoint=f"customers/{customer_id}",
                data=customer_data.model_dump(exclude_none=True)
            )

            return MollieCustomerResponse(**response_data)

        except MollieAPIError:
            raise
        except Exception as e:
            logger.error("Failed to update Mollie customer", customer_id=customer_id, error=str(e))
            raise MollieServiceError(f"Customer update failed: {str(e)}")

    # Mandate Operations (for recurring payments)
    async def create_mandate(
        self,
        customer_id: str,
        mandate_data: MollieMandateCreate
    ) -> MollieMandateResponse:
        """Create a mandate for recurring payments."""
        try:
            logger.info("Creating Mollie mandate", customer_id=customer_id, method=mandate_data.method)

            response_data = await self._make_request(
                method="POST",
                endpoint=f"customers/{customer_id}/mandates",
                data=mandate_data.model_dump(exclude_none=True)
            )

            mandate_response = MollieMandateResponse(**response_data)

            logger.info("Mollie mandate created", mandate_id=mandate_response.id, status=mandate_response.status)

            return mandate_response

        except MollieAPIError:
            raise
        except Exception as e:
            logger.error("Failed to create Mollie mandate", customer_id=customer_id, error=str(e))
            raise MollieServiceError(f"Mandate creation failed: {str(e)}")

    async def get_mandate(self, customer_id: str, mandate_id: str) -> MollieMandateResponse:
        """Retrieve mandate details."""
        try:
            response_data = await self._make_request(
                method="GET",
                endpoint=f"customers/{customer_id}/mandates/{mandate_id}"
            )

            return MollieMandateResponse(**response_data)

        except MollieAPIError:
            raise
        except Exception as e:
            logger.error("Failed to retrieve Mollie mandate", mandate_id=mandate_id, error=str(e))
            raise MollieServiceError(f"Mandate retrieval failed: {str(e)}")

    async def revoke_mandate(self, customer_id: str, mandate_id: str) -> MollieMandateResponse:
        """Revoke a mandate."""
        try:
            logger.info("Revoking Mollie mandate", customer_id=customer_id, mandate_id=mandate_id)

            response_data = await self._make_request(
                method="DELETE",
                endpoint=f"customers/{customer_id}/mandates/{mandate_id}"
            )

            return MollieMandateResponse(**response_data)

        except MollieAPIError:
            raise
        except Exception as e:
            logger.error("Failed to revoke Mollie mandate", mandate_id=mandate_id, error=str(e))
            raise MollieServiceError(f"Mandate revocation failed: {str(e)}")

    # Subscription Operations
    async def create_subscription(
        self,
        customer_id: str,
        subscription_data: MollieSubscriptionCreate
    ) -> MollieSubscriptionResponse:
        """Create a subscription for recurring payments."""
        try:
            logger.info(
                "Creating Mollie subscription",
                customer_id=customer_id,
                amount=subscription_data.amount.value,
                interval=subscription_data.interval
            )

            response_data = await self._make_request(
                method="POST",
                endpoint=f"customers/{customer_id}/subscriptions",
                data=subscription_data.model_dump(exclude_none=True)
            )

            subscription_response = MollieSubscriptionResponse(**response_data)

            logger.info("Mollie subscription created", subscription_id=subscription_response.id, status=subscription_response.status)

            return subscription_response

        except MollieAPIError:
            raise
        except Exception as e:
            logger.error("Failed to create Mollie subscription", customer_id=customer_id, error=str(e))
            raise MollieServiceError(f"Subscription creation failed: {str(e)}")

    async def get_subscription(self, customer_id: str, subscription_id: str) -> MollieSubscriptionResponse:
        """Retrieve subscription details."""
        try:
            response_data = await self._make_request(
                method="GET",
                endpoint=f"customers/{customer_id}/subscriptions/{subscription_id}"
            )

            return MollieSubscriptionResponse(**response_data)

        except MollieAPIError:
            raise
        except Exception as e:
            logger.error("Failed to retrieve Mollie subscription", subscription_id=subscription_id, error=str(e))
            raise MollieServiceError(f"Subscription retrieval failed: {str(e)}")

    async def update_subscription(
        self,
        customer_id: str,
        subscription_id: str,
        update_data: Dict[str, Any]
    ) -> MollieSubscriptionResponse:
        """Update subscription details."""
        try:
            logger.info("Updating Mollie subscription", subscription_id=subscription_id)

            response_data = await self._make_request(
                method="PATCH",
                endpoint=f"customers/{customer_id}/subscriptions/{subscription_id}",
                data=update_data
            )

            return MollieSubscriptionResponse(**response_data)

        except MollieAPIError:
            raise
        except Exception as e:
            logger.error("Failed to update Mollie subscription", subscription_id=subscription_id, error=str(e))
            raise MollieServiceError(f"Subscription update failed: {str(e)}")

    async def cancel_subscription(self, customer_id: str, subscription_id: str) -> MollieSubscriptionResponse:
        """Cancel a subscription."""
        try:
            logger.info("Canceling Mollie subscription", subscription_id=subscription_id)

            response_data = await self._make_request(
                method="DELETE",
                endpoint=f"customers/{customer_id}/subscriptions/{subscription_id}"
            )

            subscription_response = MollieSubscriptionResponse(**response_data)

            logger.info("Mollie subscription canceled", subscription_id=subscription_id, status=subscription_response.status)

            return subscription_response

        except MollieAPIError:
            raise
        except Exception as e:
            logger.error("Failed to cancel Mollie subscription", subscription_id=subscription_id, error=str(e))
            raise MollieServiceError(f"Subscription cancellation failed: {str(e)}")

    # Refund Operations
    async def create_refund(
        self,
        payment_id: str,
        refund_data: MollieRefundCreate
    ) -> MollieRefundResponse:
        """Create a refund for a payment."""
        try:
            logger.info(
                "Creating Mollie refund",
                payment_id=payment_id,
                amount=refund_data.amount.value if refund_data.amount else "full"
            )

            response_data = await self._make_request(
                method="POST",
                endpoint=f"payments/{payment_id}/refunds",
                data=refund_data.model_dump(exclude_none=True)
            )

            refund_response = MollieRefundResponse(**response_data)

            logger.info("Mollie refund created", refund_id=refund_response.id, status=refund_response.status)

            return refund_response

        except MollieAPIError:
            raise
        except Exception as e:
            logger.error("Failed to create Mollie refund", payment_id=payment_id, error=str(e))
            raise MollieServiceError(f"Refund creation failed: {str(e)}")

    async def get_refund(self, payment_id: str, refund_id: str) -> MollieRefundResponse:
        """Retrieve refund details."""
        try:
            response_data = await self._make_request(
                method="GET",
                endpoint=f"payments/{payment_id}/refunds/{refund_id}"
            )

            return MollieRefundResponse(**response_data)

        except MollieAPIError:
            raise
        except Exception as e:
            logger.error("Failed to retrieve Mollie refund", refund_id=refund_id, error=str(e))
            raise MollieServiceError(f"Refund retrieval failed: {str(e)}")

    # Webhook Validation
    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        """Verify Mollie webhook signature."""
        if not self.webhook_secret:
            logger.warning("No webhook secret configured, skipping signature verification")
            return True

        if not signature:
            logger.warning("No signature provided in webhook request")
            return False

        try:
            expected_signature = hmac.new(
                self.webhook_secret.encode('utf-8'),
                payload,
                hashlib.sha256
            ).hexdigest()

            # Mollie uses SHA-256 with a specific format
            expected_signature = f"sha256={expected_signature}"

            is_valid = hmac.compare_digest(signature, expected_signature)

            if not is_valid:
                logger.warning("Webhook signature verification failed")

            return is_valid

        except Exception as e:
            logger.error("Error verifying webhook signature", error=str(e))
            return False

    # Utility Methods
    def create_amount(self, value: Decimal, currency: str = "DKK") -> MollieAmount:
        """Create a Mollie amount object."""
        return MollieAmount(
            currency=currency.upper(),
            value=f"{value:.2f}"
        )

    def get_checkout_url(self, payment: MolliePaymentResponse) -> Optional[str]:
        """Extract checkout URL from payment response."""
        links = getattr(payment, "_links", None)
        if not links:
            return None

        checkout = getattr(links, "checkout", None)
        if not checkout:
            return None

        if isinstance(checkout, dict):
            return checkout.get("href")
        return getattr(checkout, "href", None) or (checkout.get("href") if hasattr(checkout, "get") else None)
        return None

    async def list_payment_methods(self, amount: Optional[MollieAmount] = None) -> List[Dict[str, Any]]:
        """List available payment methods."""
        try:
            params = {}
            if amount:
                params['amount[value]'] = amount.value
                params['amount[currency]'] = amount.currency

            response_data = await self._make_request(
                method="GET",
                endpoint="methods",
                params=params
            )

            return response_data.get('_embedded', {}).get('methods', [])

        except Exception as e:
            logger.error("Failed to list payment methods", error=str(e))
            raise MollieServiceError(f"Payment methods retrieval failed: {str(e)}")

    async def get_organization(self) -> Dict[str, Any]:
        """Get organization details (for verification)."""
        try:
            response_data = await self._make_request(
                method="GET",
                endpoint="organizations/me"
            )

            return response_data

        except Exception as e:
            logger.error("Failed to get organization details", error=str(e))
            raise MollieServiceError(f"Organization retrieval failed: {str(e)}")


# Global service instance
mollie_service = MollieService()


# Convenience functions
async def create_payment_for_booking(
    booking_id: str,
    amount: Decimal,
    description: str,
    customer_email: str,
    redirect_url: str,
    webhook_url: str,
    currency: str = "DKK"
) -> MolliePaymentResponse:
    """Create a payment for a booking."""
    payment_data = MolliePaymentCreate(
        amount=mollie_service.create_amount(amount, currency),
        description=description,
        redirectUrl=redirect_url,
        webhookUrl=webhook_url,
        metadata={
            "booking_id": booking_id,
            "customer_email": customer_email,
            "payment_type": "booking"
        }
    )

    return await mollie_service.create_payment(payment_data)


async def create_subscription_payment(
    customer_id: str,
    plan_name: str,
    amount: Decimal,
    interval: str,
    description: str,
    webhook_url: str,
    mandate_id: Optional[str] = None,
    currency: str = "DKK"
) -> MollieSubscriptionResponse:
    """Create a subscription for recurring payments."""
    subscription_data = MollieSubscriptionCreate(
        amount=mollie_service.create_amount(amount, currency),
        interval=interval,
        description=description,
        webhookUrl=webhook_url,
        mandateId=mandate_id,
        metadata={
            "plan_name": plan_name,
            "payment_type": "subscription"
        }
    )

    return await mollie_service.create_subscription(customer_id, subscription_data)