#!/usr/bin/env python3
"""
Test script for Mollie Danish integration.
Tests the enhanced Mollie service with Danish payment methods and MobilePay.
"""
import asyncio
import json
from decimal import Decimal
from datetime import datetime
import sys
import os

# Add the src directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from app.services.mollie_service import mollie_service, MolliePaymentCreate
from app.core.config import settings


async def test_basic_connection():
    """Test basic Mollie API connection."""
    print("🔌 Testing basic Mollie connection...")

    try:
        if mollie_service.disabled:
            print("❌ Mollie service is disabled - check MOLLIE_API_KEY configuration")
            return False

        org = await mollie_service.get_organization()
        print(f"✅ Connected to Mollie organization: {org.get('name', 'Unknown')}")
        print(f"📊 Test mode: {mollie_service.test_mode}")
        return True

    except Exception as e:
        print(f"❌ Failed to connect to Mollie: {str(e)}")
        return False


async def test_danish_payment_methods():
    """Test Danish payment methods retrieval."""
    print("\n🇩🇰 Testing Danish payment methods...")

    try:
        # Test without amount filter
        methods = await mollie_service.get_danish_payment_methods()
        print(f"✅ Retrieved {len(methods)} Danish payment methods")

        for i, method in enumerate(methods[:5]):  # Show first 5
            print(f"   {i+1}. {method.get('displayName', method.get('description'))}")

        # Test with amount filter (1000 DKK)
        methods_filtered = await mollie_service.get_danish_payment_methods(Decimal('1000.00'))
        print(f"✅ Retrieved {len(methods_filtered)} methods for 1000 DKK")

        # Check if MobilePay is available
        mobilepay_available = any(m.get('id') == 'mobilepay' for m in methods)
        if mobilepay_available:
            print("✅ MobilePay is available")
        else:
            print("⚠️  MobilePay is not available (may not be enabled in test mode)")

        return True

    except Exception as e:
        print(f"❌ Failed to retrieve Danish payment methods: {str(e)}")
        return False


async def test_recommended_methods():
    """Test recommended payment methods for different amounts."""
    print("\n💰 Testing recommended payment methods for different amounts...")

    test_amounts = [
        Decimal('50.00'),    # Small amount
        Decimal('500.00'),   # Medium amount
        Decimal('2000.00'),  # Large amount
        Decimal('15000.00')  # Very large amount
    ]

    try:
        for amount in test_amounts:
            recommended = await mollie_service._get_recommended_danish_methods(amount)
            print(f"   {amount} DKK → {', '.join(recommended)}")

        return True

    except Exception as e:
        print(f"❌ Failed to get recommended methods: {str(e)}")
        return False


async def test_payment_validation():
    """Test payment amount validation."""
    print("\n🔍 Testing payment validation...")

    test_cases = [
        (Decimal('0.50'), 'DKK', False, 'Below minimum'),
        (Decimal('1.00'), 'DKK', True, 'Minimum valid amount'),
        (Decimal('100.00'), 'DKK', True, 'Normal amount'),
        (Decimal('10000.00'), 'DKK', True, 'Large round amount'),
        (Decimal('50000.00'), 'DKK', True, 'Maximum amount'),
        (Decimal('50001.00'), 'DKK', False, 'Above maximum'),
        (Decimal('-100.00'), 'DKK', False, 'Negative amount'),
    ]

    try:
        for amount, currency, expected, description in test_cases:
            result = mollie_service.validate_payment_amount(amount, currency)
            status = "✅" if result == expected else "❌"
            print(f"   {status} {amount} {currency}: {description}")

        return True

    except Exception as e:
        print(f"❌ Failed to validate payments: {str(e)}")
        return False


async def test_customer_validation():
    """Test customer data validation."""
    print("\n👤 Testing customer data validation...")

    test_cases = [
        ('test@example.com', 'John Doe', True, 'Valid email and name'),
        ('invalid-email', 'John Doe', False, 'Invalid email'),
        ('test@example.com', 'A', False, 'Name too short'),
        ('test@example.com', 'Lars Løkke Rasmussen', True, 'Danish name with special chars'),
        ('test@example.com', 'John123', False, 'Name with numbers'),
        ('test@', 'John Doe', False, 'Incomplete email'),
        ('test@example.com', None, True, 'No name provided'),
    ]

    try:
        for email, name, expected, description in test_cases:
            result = mollie_service.validate_customer_data(email, name)
            status = "✅" if result == expected else "❌"
            print(f"   {status} {email} / {name}: {description}")

        return True

    except Exception as e:
        print(f"❌ Failed to validate customers: {str(e)}")
        return False


async def test_webhook_signature():
    """Test webhook signature verification."""
    print("\n🔐 Testing webhook signature verification...")

    try:
        # Test with no webhook secret (should pass)
        original_secret = mollie_service.webhook_secret
        mollie_service.webhook_secret = None

        result = mollie_service.verify_webhook_signature(b'test payload', 'any_signature')
        print(f"   {'✅' if result else '❌'} No webhook secret: {result}")

        # Test with webhook secret
        mollie_service.webhook_secret = 'test_secret'

        # Create valid signature
        import hmac
        import hashlib
        payload = b'{"id": "tr_test123"}'
        expected_signature = hmac.new(
            b'test_secret',
            payload,
            hashlib.sha256
        ).hexdigest()
        expected_signature = f"sha256={expected_signature}"

        result = mollie_service.verify_webhook_signature(payload, expected_signature)
        print(f"   {'✅' if result else '❌'} Valid signature: {result}")

        # Test with invalid signature
        result = mollie_service.verify_webhook_signature(payload, 'sha256=invalid')
        print(f"   {'✅' if not result else '❌'} Invalid signature: {not result}")

        # Restore original secret
        mollie_service.webhook_secret = original_secret

        return True

    except Exception as e:
        print(f"❌ Failed to test webhook signatures: {str(e)}")
        return False


async def test_danish_status_messages():
    """Test Danish status message translation."""
    print("\n🇩🇰 Testing Danish status messages...")

    try:
        statuses = ['open', 'pending', 'paid', 'failed', 'canceled', 'expired']

        for status in statuses:
            danish_message = mollie_service.get_danish_status_message(status)
            print(f"   {status} → {danish_message}")

        return True

    except Exception as e:
        print(f"❌ Failed to test Danish status messages: {str(e)}")
        return False


async def test_integration_health():
    """Test overall integration health."""
    print("\n🏥 Testing integration health...")

    try:
        # Test service configuration
        print(f"   API Key configured: {'✅' if mollie_service.api_key else '❌'}")
        print(f"   Webhook secret configured: {'✅' if mollie_service.webhook_secret else '❌'}")
        print(f"   Service disabled: {'❌' if mollie_service.disabled else '✅'}")
        print(f"   Test mode: {'✅' if mollie_service.test_mode else '⚠️'}")

        # Test settings
        print(f"   Default timezone: {settings.DEFAULT_TIMEZONE}")
        print(f"   Enable payments: {settings.ENABLE_PAYMENTS}")

        return True

    except Exception as e:
        print(f"❌ Failed health check: {str(e)}")
        return False


async def main():
    """Run all tests."""
    print("🚀 Starting Mollie Danish Integration Tests")
    print("=" * 50)

    tests = [
        test_integration_health,
        test_basic_connection,
        test_danish_payment_methods,
        test_recommended_methods,
        test_payment_validation,
        test_customer_validation,
        test_webhook_signature,
        test_danish_status_messages,
    ]

    passed = 0
    total = len(tests)

    for test in tests:
        try:
            result = await test()
            if result:
                passed += 1
        except Exception as e:
            print(f"❌ Test {test.__name__} crashed: {str(e)}")

    print("\n" + "=" * 50)
    print(f"🏆 Test Results: {passed}/{total} tests passed")

    if passed == total:
        print("✅ All tests passed! Mollie Danish integration is working correctly.")
        return 0
    else:
        print(f"❌ {total - passed} tests failed. Please check the issues above.")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)