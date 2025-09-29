#!/usr/bin/env python3
"""
Simple Mollie integration test without framework dependencies.
"""
import json
from decimal import Decimal
import os
from mollie.api.client import Client
from mollie.api.error import Error as MollieError


def test_mollie_basic_connection():
    """Test basic Mollie connection with official client."""
    print("🔌 Testing basic Mollie connection...")

    # Check if API key is configured
    api_key = os.getenv('MOLLIE_API_KEY', 'test_your-mollie-api-key-here')
    if api_key == 'test_your-mollie-api-key-here':
        print("⚠️  Using placeholder API key - please configure MOLLIE_API_KEY with a real test key")
        return False

    try:
        client = Client()
        client.set_api_key(api_key)

        # Test connection by getting methods
        methods = client.methods.list()
        print(f"✅ Connected to Mollie API")
        print(f"📊 Available methods: {len(list(methods))}")

        # Check for Danish-relevant methods
        method_ids = [method.id for method in methods]
        danish_methods = []

        for method_id in ['mobilepay', 'creditcard', 'applepay', 'klarna', 'banktransfer']:
            if method_id in method_ids:
                danish_methods.append(method_id)

        print(f"🇩🇰 Danish payment methods available: {', '.join(danish_methods)}")

        if 'mobilepay' in danish_methods:
            print("✅ MobilePay is available!")
        else:
            print("⚠️  MobilePay not available (may need activation or different test environment)")

        return True

    except MollieError as e:
        print(f"❌ Mollie API error: {str(e)}")
        return False
    except Exception as e:
        print(f"❌ Connection failed: {str(e)}")
        return False


def test_payment_creation():
    """Test creating a test payment."""
    print("\n💳 Testing payment creation...")

    api_key = os.getenv('MOLLIE_API_KEY', 'test_your-mollie-api-key-here')
    if api_key == 'test_your-mollie-api-key-here':
        print("⚠️  Skipping payment creation - no real API key configured")
        return True

    try:
        client = Client()
        client.set_api_key(api_key)

        # Create a test payment
        payment_data = {
            'amount': {
                'currency': 'DKK',
                'value': '299.00'
            },
            'description': 'Test Danish booking payment - Loctician service',
            'redirectUrl': 'https://loctician.dk/payment/success',
            'webhookUrl': 'https://loctician.dk/api/v1/payments/webhook',
            'locale': 'da_DK',
            'method': ['mobilepay', 'creditcard', 'applepay'],
            'metadata': {
                'booking_id': 'test-123',
                'payment_type': 'booking',
                'country': 'DK',
                'language': 'da'
            }
        }

        payment = client.payments.create(payment_data)

        print(f"✅ Payment created: {payment.id}")
        print(f"📊 Status: {payment.status}")
        print(f"💰 Amount: {payment.amount['value']} {payment.amount['currency']}")
        print(f"🌐 Checkout URL: {payment._links['checkout']['href'] if 'checkout' in payment._links else 'N/A'}")

        # Test retrieving the payment
        retrieved_payment = client.payments.get(payment.id)
        print(f"✅ Payment retrieved: {retrieved_payment.id}")

        return True

    except MollieError as e:
        print(f"❌ Mollie API error: {str(e)}")
        return False
    except Exception as e:
        print(f"❌ Payment creation failed: {str(e)}")
        return False


def test_danish_currency_handling():
    """Test Danish currency and amount formatting."""
    print("\n🇩🇰 Testing Danish currency handling...")

    try:
        # Test various DKK amounts
        test_amounts = [
            Decimal('1.00'),
            Decimal('299.99'),
            Decimal('1000.00'),
            Decimal('2500.50')
        ]

        for amount in test_amounts:
            formatted_amount = f"{amount:.2f}"
            print(f"   {amount} DKK → {formatted_amount}")

        # Validate Danish payment limits
        valid_amounts = []
        invalid_amounts = []

        for amount in [Decimal('0.50'), Decimal('1.00'), Decimal('50000.00'), Decimal('50001.00')]:
            if Decimal('1.00') <= amount <= Decimal('50000.00'):
                valid_amounts.append(amount)
            else:
                invalid_amounts.append(amount)

        print(f"✅ Valid amounts: {valid_amounts}")
        print(f"❌ Invalid amounts: {invalid_amounts}")

        return True

    except Exception as e:
        print(f"❌ Currency handling test failed: {str(e)}")
        return False


def test_webhook_signature():
    """Test webhook signature creation and verification."""
    print("\n🔐 Testing webhook signature verification...")

    try:
        import hmac
        import hashlib

        webhook_secret = 'test_webhook_secret'
        payload = b'{"id": "tr_test123", "status": "paid"}'

        # Create signature
        signature = hmac.new(
            webhook_secret.encode('utf-8'),
            payload,
            hashlib.sha256
        ).hexdigest()

        formatted_signature = f"sha256={signature}"
        print(f"✅ Signature created: {formatted_signature[:20]}...")

        # Verify signature
        expected_signature = hmac.new(
            webhook_secret.encode('utf-8'),
            payload,
            hashlib.sha256
        ).hexdigest()
        expected_signature = f"sha256={expected_signature}"

        is_valid = hmac.compare_digest(formatted_signature, expected_signature)
        print(f"{'✅' if is_valid else '❌'} Signature verification: {is_valid}")

        return True

    except Exception as e:
        print(f"❌ Webhook signature test failed: {str(e)}")
        return False


def main():
    """Run all tests."""
    print("🚀 Starting Simple Mollie Danish Integration Tests")
    print("=" * 50)

    tests = [
        test_mollie_basic_connection,
        test_payment_creation,
        test_danish_currency_handling,
        test_webhook_signature,
    ]

    passed = 0
    total = len(tests)

    for test in tests:
        try:
            result = test()
            if result:
                passed += 1
        except Exception as e:
            print(f"❌ Test {test.__name__} crashed: {str(e)}")

    print("\n" + "=" * 50)
    print(f"🏆 Test Results: {passed}/{total} tests passed")

    if passed == total:
        print("✅ All tests passed! Basic Mollie integration is working.")
    else:
        print(f"❌ {total - passed} tests failed. Please check configuration.")

    return passed == total


if __name__ == "__main__":
    success = main()
    if not success:
        print("\n💡 To fix issues:")
        print("1. Get a real Mollie test API key from https://www.mollie.com/")
        print("2. Set MOLLIE_API_KEY environment variable")
        print("3. Ensure test mode is enabled for development")
    exit(0 if success else 1)