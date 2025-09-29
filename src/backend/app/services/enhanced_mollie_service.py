"""
Enhanced Mollie Payment Service with Danish localization and MobilePay support.
Combines the official Mollie client with custom features for Danish businesses.
"""
import asyncio
import hmac
import hashlib
import json
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional, Union

import structlog
from fastapi import HTTPException, status
from mollie.api.client import Client
from mollie.api.error import Error as MollieError

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

# Danish payment method configurations
DANISH_PAYMENT_METHODS = {
    'mobilepay': {
        'name': 'MobilePay',
        'description': 'Danmarks mest populære mobile betalingsløsning',
        'icon': 'mobilepay',
        'min_amount': Decimal('1.00'),
        'max_amount': Decimal('50000.00'),
        'currency': 'DKK',
        'supported_countries': ['DK'],
        'processing_time': '24h',
        'popular': True
    },
    'creditcard': {
        'name': 'Dankort/Kreditkort',
        'description': 'Visa, Mastercard, Dankort',
        'icon': 'creditcard',
        'min_amount': Decimal('1.00'),
        'max_amount': Decimal('50000.00'),
        'currency': 'DKK',
        'supported_countries': ['DK', 'NO', 'SE', 'FI'],
        'processing_time': 'instant',
        'popular': True
    },
    'applepay': {
        'name': 'Apple Pay',
        'description': 'Betal med Apple Pay',
        'icon': 'applepay',
        'min_amount': Decimal('1.00'),
        'max_amount': Decimal('50000.00'),
        'currency': 'DKK',
        'supported_countries': ['DK'],
        'processing_time': 'instant',
        'popular': True
    },
    'googlepay': {
        'name': 'Google Pay',
        'description': 'Betal med Google Pay',
        'icon': 'googlepay',
        'min_amount': Decimal('1.00'),
        'max_amount': Decimal('50000.00'),
        'currency': 'DKK',
        'supported_countries': ['DK'],
        'processing_time': 'instant',
        'popular': False
    },
    'banktransfer': {
        'name': 'Bankoverførsel',
        'description': 'Traditionel bankoverførsel',
        'icon': 'banktransfer',
        'min_amount': Decimal('1.00'),
        'max_amount': Decimal('50000.00'),
        'currency': 'DKK',
        'supported_countries': ['DK'],
        'processing_time': '1-2 days',
        'popular': False
    },
    'klarna': {
        'name': 'Klarna',
        'description': 'Køb nu, betal senere',
        'icon': 'klarna',
        'min_amount': Decimal('1.00'),
        'max_amount': Decimal('10000.00'),
        'currency': 'DKK',
        'supported_countries': ['DK', 'NO', 'SE', 'FI'],
        'processing_time': 'instant',
        'popular': True
    }
}

# Danish localization
DANISH_STRINGS = {
    'payment_success': 'Betaling gennemført',
    'payment_failed': 'Betaling fejlede',
    'payment_pending': 'Betaling ventende',
    'payment_cancelled': 'Betaling annulleret',
    'booking_payment': 'Betaling for booking',
    'subscription_payment': 'Abonnementsbetaling',
    'refund_processed': 'Refundering behandlet',
    'invoice_payment': 'Fakturabetaling',
    'service_payment': 'Betaling for ydelse',
}


class EnhancedMollieServiceError(Exception):
    """Base exception for enhanced Mollie service errors."""
    pass


class EnhancedMollieAPIError(EnhancedMollieServiceError):
    """Enhanced Mollie API specific errors."""
    def __init__(self, message: str, status_code: int, error_type: str = None, mollie_error: MollieError = None):
        super().__init__(message)
        self.status_code = status_code
        self.error_type = error_type
        self.mollie_error = mollie_error


class EnhancedMollieService:
    """
    Enhanced Mollie payment service with Danish localization and MobilePay support.

    Features:
    - Official Mollie Python client integration
    - Danish payment methods (MobilePay, Dankort, etc.)
    - DKK currency handling
    - Danish language support
    - Enhanced error handling
    - Webhook security
    - Subscription management
    """

    def __init__(self, api_key: str = None, webhook_secret: str = None):
        """Initialize enhanced Mollie service with API credentials."""
        self.api_key = api_key or getattr(settings, 'MOLLIE_API_KEY', None)
        self.webhook_secret = webhook_secret or getattr(settings, 'MOLLIE_WEBHOOK_SECRET', None)
        self.disabled = False

        if not self.api_key:
            logger.warning(
                "Mollie API key is not configured; payment features are disabled."
            )
            self.disabled = True
            self.test_mode = True
            self.client = None
            return

        # Initialize official Mollie client
        self.client = Client()
        self.client.set_api_key(self.api_key)

        # Determine if we're in test mode
        self.test_mode = self.api_key.startswith('test_')

        logger.info(
            "Enhanced Mollie service initialized",
            test_mode=self.test_mode,
            has_webhook_secret=bool(self.webhook_secret),
            danish_methods=list(DANISH_PAYMENT_METHODS.keys())
        )

    def _ensure_configured(self) -> None:
        """Ensure the Mollie service has been configured."""
        if self.disabled:
            raise EnhancedMollieServiceError(
                "Enhanced Mollie service is not configured. Set MOLLIE_API_KEY to enable payments."
            )

    def _handle_mollie_error(self, error: MollieError, operation: str) -> None:
        """Convert Mollie API errors to enhanced errors."""
        logger.error(f"Mollie API error during {operation}", error=str(error))

        status_code = getattr(error, 'status', 400)
        error_type = getattr(error, 'type', 'unknown')

        raise EnhancedMollieAPIError(
            message=str(error),
            status_code=status_code,
            error_type=error_type,
            mollie_error=error
        )

    # Danish Payment Method Support
    def get_danish_payment_methods(self, amount: Optional[Decimal] = None) -> List[Dict[str, Any]]:
        """Get available Danish payment methods with localized information."""
        available_methods = []

        for method_id, method_config in DANISH_PAYMENT_METHODS.items():
            # Filter by amount if specified
            if amount:
                if amount < method_config['min_amount'] or amount > method_config['max_amount']:
                    continue

            available_methods.append({
                'id': method_id,
                'name': method_config['name'],
                'description': method_config['description'],
                'icon': method_config['icon'],
                'min_amount': str(method_config['min_amount']),
                'max_amount': str(method_config['max_amount']),
                'currency': method_config['currency'],
                'processing_time': method_config['processing_time'],
                'popular': method_config['popular']
            })

        # Sort by popularity and name
        available_methods.sort(key=lambda x: (not x['popular'], x['name']))
        return available_methods

    def get_recommended_payment_methods(self, amount: Decimal, customer_country: str = 'DK') -> List[str]:
        """Get recommended payment methods for Danish customers based on amount and preferences."""
        recommended = []

        # Always recommend MobilePay for Danish customers
        if customer_country == 'DK':
            if Decimal('1.00') <= amount <= Decimal('50000.00'):
                recommended.append('mobilepay')

        # Credit cards are universally accepted
        if amount >= Decimal('1.00'):
            recommended.append('creditcard')

        # Apple Pay for convenience
        if amount <= Decimal('10000.00'):
            recommended.append('applepay')

        # Klarna for larger amounts (buy now, pay later)
        if Decimal('100.00') <= amount <= Decimal('10000.00'):
            recommended.append('klarna')

        return recommended

    # Enhanced Payment Operations
    async def create_payment(
        self,
        payment_data: MolliePaymentCreate,
        idempotency_key: Optional[str] = None,
        danish_locale: bool = True
    ) -> MolliePaymentResponse:
        """Create a new payment with enhanced Danish support."""
        self._ensure_configured()

        try:
            # Enhance payment data with Danish defaults
            payment_dict = payment_data.model_dump(exclude_none=True)

            # Set Danish locale if requested
            if danish_locale and not payment_dict.get('locale'):
                payment_dict['locale'] = 'da_DK'

            # Add recommended payment methods for Danish customers
            if not payment_dict.get('method'):
                amount = Decimal(payment_data.amount.value)
                recommended_methods = self.get_recommended_payment_methods(amount)
                payment_dict['method'] = recommended_methods[:3]  # Limit to top 3

            # Add Danish description prefix if not present
            description = payment_dict.get('description', '')
            if danish_locale and not any(danish_word in description.lower() for danish_word in ['betaling', 'booking', 'ydelse']):
                payment_dict['description'] = f"Betaling: {description}"

            logger.info(
                "Creating enhanced Mollie payment",
                amount=payment_data.amount.value,
                currency=payment_data.amount.currency,
                methods=payment_dict.get('method', []),
                danish_locale=danish_locale
            )

            # Create payment using official client
            payment = self.client.payments.create(payment_dict)

            # Convert to our response format
            payment_response = MolliePaymentResponse(
                id=payment.id,
                mode=payment.mode,
                createdAt=payment.created_at,
                status=payment.status,
                isCancelable=payment.is_cancelable,
                amount=MollieAmount(
                    currency=payment.amount['currency'],
                    value=payment.amount['value']
                ),
                description=payment.description,
                redirectUrl=payment.redirect_url,
                webhookUrl=payment.webhook_url,
                method=payment.method,
                metadata=payment.metadata,
                locale=payment.locale,
                profileId=payment.profile_id,
                _links={
                    'self': {'href': payment._links['self']['href']},
                    'checkout': {'href': payment._links['checkout']['href']} if 'checkout' in payment._links else None
                }
            )

            logger.info(
                "Enhanced Mollie payment created",
                payment_id=payment_response.id,
                status=payment_response.status,
                method=payment_response.method
            )

            return payment_response

        except MollieError as e:
            self._handle_mollie_error(e, "payment creation")
        except Exception as e:
            logger.error("Failed to create enhanced Mollie payment", error=str(e))
            raise EnhancedMollieServiceError(f"Payment creation failed: {str(e)}")

    async def get_payment(self, payment_id: str) -> MolliePaymentResponse:
        """Retrieve payment details with enhanced error handling."""
        self._ensure_configured()

        try:
            logger.debug("Retrieving enhanced Mollie payment", payment_id=payment_id)

            payment = self.client.payments.get(payment_id)

            # Convert to our response format
            return MolliePaymentResponse(
                id=payment.id,
                mode=payment.mode,
                createdAt=payment.created_at,
                status=payment.status,
                isCancelable=payment.is_cancelable,
                amount=MollieAmount(
                    currency=payment.amount['currency'],
                    value=payment.amount['value']
                ),
                description=payment.description,
                redirectUrl=payment.redirect_url,
                webhookUrl=payment.webhook_url,
                method=payment.method,
                metadata=payment.metadata,
                locale=payment.locale,
                profileId=payment.profile_id,
                paidAt=payment.paid_at,
                canceledAt=payment.canceled_at,
                expiredAt=payment.expired_at,
                failedAt=payment.failed_at,
                _links={
                    'self': {'href': payment._links['self']['href']},
                    'checkout': {'href': payment._links['checkout']['href']} if 'checkout' in payment._links else None
                }
            )

        except MollieError as e:
            self._handle_mollie_error(e, "payment retrieval")
        except Exception as e:
            logger.error("Failed to retrieve enhanced Mollie payment", payment_id=payment_id, error=str(e))
            raise EnhancedMollieServiceError(f"Payment retrieval failed: {str(e)}")

    async def cancel_payment(self, payment_id: str) -> MolliePaymentResponse:
        """Cancel a payment with enhanced logging."""
        self._ensure_configured()

        try:
            logger.info("Canceling enhanced Mollie payment", payment_id=payment_id)

            payment = self.client.payments.delete(payment_id)

            # Convert to our response format
            payment_response = MolliePaymentResponse(
                id=payment.id,
                mode=payment.mode,
                createdAt=payment.created_at,
                status=payment.status,
                isCancelable=payment.is_cancelable,
                amount=MollieAmount(
                    currency=payment.amount['currency'],
                    value=payment.amount['value']
                ),
                description=payment.description,
                redirectUrl=payment.redirect_url,
                webhookUrl=payment.webhook_url,
                method=payment.method,
                metadata=payment.metadata,
                locale=payment.locale,
                profileId=payment.profile_id,
                canceledAt=payment.canceled_at,
                _links={
                    'self': {'href': payment._links['self']['href']}
                }
            )

            logger.info("Enhanced Mollie payment canceled", payment_id=payment_id, status=payment_response.status)
            return payment_response

        except MollieError as e:
            self._handle_mollie_error(e, "payment cancellation")
        except Exception as e:
            logger.error("Failed to cancel enhanced Mollie payment", payment_id=payment_id, error=str(e))
            raise EnhancedMollieServiceError(f"Payment cancellation failed: {str(e)}")

    # Utility Methods
    def create_amount(self, value: Decimal, currency: str = "DKK") -> MollieAmount:
        """Create a Mollie amount object with Danish currency default."""
        return MollieAmount(
            currency=currency.upper(),
            value=f"{value:.2f}"
        )

    def get_checkout_url(self, payment: Union[MolliePaymentResponse, Any]) -> Optional[str]:
        """Extract checkout URL from payment response."""
        if hasattr(payment, '_links'):
            links = payment._links
            if isinstance(links, dict) and 'checkout' in links:
                checkout = links['checkout']
                if isinstance(checkout, dict):
                    return checkout.get('href')
        return None

    def get_danish_status_text(self, status: str) -> str:
        """Get Danish status text for payment status."""
        status_mapping = {
            'open': 'Åben',
            'pending': 'Ventende',
            'paid': 'Betalt',
            'failed': 'Fejlet',
            'canceled': 'Annulleret',
            'expired': 'Udløbet',
            'authorized': 'Autoriseret',
            'shipping': 'Levering',
            'completed': 'Fuldført'
        }
        return status_mapping.get(status, status.title())

    # Enhanced Webhook Validation
    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        """Verify Mollie webhook signature with enhanced security."""
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
                logger.warning("Enhanced webhook signature verification failed")

            return is_valid

        except Exception as e:
            logger.error("Error verifying enhanced webhook signature", error=str(e))
            return False

    # Health Check
    async def health_check(self) -> Dict[str, Any]:
        """Enhanced health check with Danish payment method availability."""
        if self.disabled:
            return {
                'status': 'disabled',
                'message': 'Mollie service is not configured'
            }

        try:
            # Test connection by getting organization info
            organization = self.client.organizations.get('me')

            # Get available payment methods
            methods = self.client.methods.list()
            available_danish_methods = [
                method.id for method in methods
                if method.id in DANISH_PAYMENT_METHODS.keys()
            ]

            return {
                'status': 'healthy',
                'mollie_connected': True,
                'organization': organization.name,
                'test_mode': self.test_mode,
                'danish_methods_available': available_danish_methods,
                'danish_methods_count': len(available_danish_methods),
                'timestamp': datetime.utcnow().isoformat()
            }

        except MollieError as e:
            logger.error("Enhanced Mollie health check failed", error=str(e))
            return {
                'status': 'unhealthy',
                'mollie_connected': False,
                'error': str(e),
                'test_mode': self.test_mode,
                'timestamp': datetime.utcnow().isoformat()
            }


# Global enhanced service instance
enhanced_mollie_service = EnhancedMollieService()


# Enhanced convenience functions for Danish businesses
async def create_danish_booking_payment(
    booking_id: str,
    amount: Decimal,
    description: str,
    customer_email: str,
    redirect_url: str,
    webhook_url: str,
    preferred_methods: Optional[List[str]] = None
) -> MolliePaymentResponse:
    """Create a payment for a Danish booking with localized settings."""

    # Use recommended methods if none specified
    if not preferred_methods:
        preferred_methods = enhanced_mollie_service.get_recommended_payment_methods(amount)

    # Create Danish description
    danish_description = f"Booking betaling - {description}"

    payment_data = MolliePaymentCreate(
        amount=enhanced_mollie_service.create_amount(amount, "DKK"),
        description=danish_description,
        redirectUrl=redirect_url,
        webhookUrl=webhook_url,
        method=preferred_methods,
        locale='da_DK',
        metadata={
            "booking_id": booking_id,
            "customer_email": customer_email,
            "payment_type": "booking",
            "country": "DK",
            "language": "da"
        }
    )

    return await enhanced_mollie_service.create_payment(payment_data, danish_locale=True)


async def create_danish_subscription_payment(
    customer_id: str,
    plan_name: str,
    amount: Decimal,
    interval: str,
    description: str,
    webhook_url: str,
    mandate_id: Optional[str] = None
) -> MollieSubscriptionResponse:
    """Create a subscription for Danish customers with localized settings."""

    # Create Danish description
    danish_description = f"Abonnement - {plan_name}: {description}"

    subscription_data = MollieSubscriptionCreate(
        amount=enhanced_mollie_service.create_amount(amount, "DKK"),
        interval=interval,
        description=danish_description,
        webhookUrl=webhook_url,
        mandateId=mandate_id,
        metadata={
            "plan_name": plan_name,
            "payment_type": "subscription",
            "country": "DK",
            "language": "da"
        }
    )

    try:
        # This would need to be implemented with the subscription creation logic
        # For now, we'll raise an error indicating this needs implementation
        raise NotImplementedError("Enhanced subscription creation needs to be implemented with official client")

    except Exception as e:
        logger.error("Failed to create Danish subscription", error=str(e))
        raise EnhancedMollieServiceError(f"Subscription creation failed: {str(e)}")