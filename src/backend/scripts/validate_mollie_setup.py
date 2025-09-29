#!/usr/bin/env python3
"""
Mollie Payment Integration Validation Script

This script validates that the Mollie payment integration is properly configured
and all components are working correctly.

Usage:
    python scripts/validate_mollie_setup.py
"""

import asyncio
import os
import sys
from decimal import Decimal
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.config import settings
from app.services.mollie_service import mollie_service, MollieAPIError
from app.schemas.mollie_payment import MolliePaymentCreate, MollieAmount


class ValidationError(Exception):
    """Custom validation error."""
    pass


class MollieSetupValidator:
    """Validates Mollie payment integration setup."""

    def __init__(self):
        self.errors = []
        self.warnings = []
        self.passed_checks = []

    def add_error(self, message: str):
        """Add validation error."""
        self.errors.append(f"❌ ERROR: {message}")

    def add_warning(self, message: str):
        """Add validation warning."""
        self.warnings.append(f"⚠️  WARNING: {message}")

    def add_success(self, message: str):
        """Add successful validation."""
        self.passed_checks.append(f"✅ {message}")

    def validate_environment_variables(self):
        """Validate required environment variables."""
        print("🔍 Validating environment variables...")

        # Required variables
        required_vars = [
            ('MOLLIE_API_KEY', 'Mollie API key'),
            ('SECRET_KEY', 'JWT secret key'),
            ('DATABASE_URL', 'Database connection URL'),
        ]

        for var_name, description in required_vars:
            value = getattr(settings, var_name, None)
            if not value:
                self.add_error(f"Missing {description} ({var_name})")
            else:
                self.add_success(f"{description} is configured")

        # Validate API key format
        if hasattr(settings, 'MOLLIE_API_KEY') and settings.MOLLIE_API_KEY:
            api_key = settings.MOLLIE_API_KEY
            if api_key.startswith('test_'):
                self.add_success("Using Mollie test API key")
            elif api_key.startswith('live_'):
                self.add_warning("Using Mollie live API key - ensure this is intentional")
            else:
                self.add_error("Invalid Mollie API key format")

        # Validate webhook secret
        if hasattr(settings, 'MOLLIE_WEBHOOK_SECRET') and settings.MOLLIE_WEBHOOK_SECRET:
            webhook_secret = settings.MOLLIE_WEBHOOK_SECRET
            if len(webhook_secret) < 32:
                self.add_warning("Webhook secret should be at least 32 characters for security")
            else:
                self.add_success("Webhook secret is configured with adequate length")
        else:
            self.add_warning("Webhook secret not configured - webhook signature verification will be skipped")

    def validate_dependencies(self):
        """Validate required Python packages."""
        print("🔍 Validating Python dependencies...")

        required_packages = [
            ('mollie', 'mollie-api-python'),
            ('fastapi', 'FastAPI web framework'),
            ('sqlalchemy', 'SQLAlchemy ORM'),
            ('asyncpg', 'PostgreSQL async driver'),
            ('pydantic', 'Data validation'),
            ('structlog', 'Structured logging'),
            ('httpx', 'HTTP client'),
        ]

        for package_name, description in required_packages:
            try:
                __import__(package_name)
                self.add_success(f"{description} is installed")
            except ImportError:
                self.add_error(f"Missing required package: {package_name}")

    def validate_database_schema(self):
        """Validate database schema."""
        print("🔍 Validating database schema...")

        required_tables = [
            'users',
            'subscription_plans',
            'user_subscriptions',
            'subscription_statuses',
            'payment_intents',
            'user_payment_customers',
            'refunds',
            'payment_transactions',
        ]

        # Note: In a real scenario, you would connect to the database
        # and check if these tables exist. For this validation script,
        # we'll assume they exist if the migration files are present.

        migration_files = [
            'src/db/005_create_subscriptions_table.sql',
            'src/db/010_create_payment_tables.sql',
        ]

        project_root = backend_dir.parent
        for migration_file in migration_files:
            file_path = project_root / migration_file
            if file_path.exists():
                self.add_success(f"Migration file exists: {migration_file}")
            else:
                self.add_error(f"Missing migration file: {migration_file}")

    def validate_file_structure(self):
        """Validate required files exist."""
        print("🔍 Validating file structure...")

        required_files = [
            'app/services/mollie_service.py',
            'app/schemas/mollie_payment.py',
            'app/schemas/subscription_extended.py',
            'app/api/v1/endpoints/payments_mollie.py',
            'app/api/v1/endpoints/admin_payments.py',
            'app/core/config.py',
        ]

        for file_path in required_files:
            full_path = backend_dir / file_path
            if full_path.exists():
                self.add_success(f"Required file exists: {file_path}")
            else:
                self.add_error(f"Missing required file: {file_path}")

        # Check frontend components
        frontend_dir = backend_dir.parent / 'frontend' / 'src' / 'components'
        frontend_components = [
            'payments/SubscriptionPlans.tsx',
            'payments/PaymentForm.tsx',
            'payments/SubscriptionDashboard.tsx',
            'admin/PaymentManagement.tsx',
        ]

        for component_path in frontend_components:
            full_path = frontend_dir / component_path
            if full_path.exists():
                self.add_success(f"Frontend component exists: {component_path}")
            else:
                self.add_warning(f"Frontend component not found: {component_path}")

    async def validate_mollie_connection(self):
        """Validate connection to Mollie API."""
        print("🔍 Validating Mollie API connection...")

        if not hasattr(settings, 'MOLLIE_API_KEY') or not settings.MOLLIE_API_KEY:
            self.add_error("Cannot test Mollie connection - API key not configured")
            return

        try:
            # Test organization endpoint
            organization = await mollie_service.get_organization()
            self.add_success(f"Connected to Mollie - Organization: {organization.get('name', 'Unknown')}")

            # Test payment methods endpoint
            methods = await mollie_service.list_payment_methods()
            self.add_success(f"Retrieved {len(methods)} payment methods from Mollie")

            # Test creating a small test payment (won't be charged)
            test_payment_data = MolliePaymentCreate(
                amount=MollieAmount(currency="DKK", value="1.00"),
                description="Validation test payment",
                redirectUrl="https://example.com/success",
                webhookUrl="https://example.com/webhook"
            )

            test_payment = await mollie_service.create_payment(test_payment_data)
            self.add_success("Successfully created test payment with Mollie")

            # Cancel the test payment to avoid any charges
            try:
                await mollie_service.cancel_payment(test_payment.id)
                self.add_success("Successfully cancelled test payment")
            except MollieAPIError:
                # Payment might not be cancellable, which is fine
                pass

        except MollieAPIError as e:
            self.add_error(f"Mollie API error: {e}")
        except Exception as e:
            self.add_error(f"Failed to connect to Mollie: {e}")

    def validate_security_settings(self):
        """Validate security configuration."""
        print("🔍 Validating security settings...")

        # Check if using HTTPS in production
        cors_origins = getattr(settings, 'cors_origins_list', [])
        if cors_origins:
            for origin in cors_origins:
                if origin.startswith('https://'):
                    self.add_success(f"HTTPS origin configured: {origin}")
                elif origin.startswith('http://localhost') or origin.startswith('http://127.0.0.1'):
                    self.add_success(f"Development origin configured: {origin}")
                else:
                    self.add_warning(f"Non-HTTPS origin in production: {origin}")

        # Check environment
        env = getattr(settings, 'ENVIRONMENT', 'development')
        debug = getattr(settings, 'DEBUG', True)

        if env == 'production' and debug:
            self.add_warning("DEBUG mode is enabled in production environment")
        elif env == 'production':
            self.add_success("Production environment properly configured")
        else:
            self.add_success(f"Development environment: {env}")

    async def run_validation(self):
        """Run all validation checks."""
        print("🚀 Starting Mollie Payment Integration Validation")
        print("=" * 60)

        # Run validation checks
        self.validate_environment_variables()
        self.validate_dependencies()
        self.validate_file_structure()
        self.validate_database_schema()
        await self.validate_mollie_connection()
        self.validate_security_settings()

        # Print results
        print("\n" + "=" * 60)
        print("📊 VALIDATION RESULTS")
        print("=" * 60)

        if self.passed_checks:
            print("\n✅ PASSED CHECKS:")
            for check in self.passed_checks:
                print(f"   {check}")

        if self.warnings:
            print("\n⚠️  WARNINGS:")
            for warning in self.warnings:
                print(f"   {warning}")

        if self.errors:
            print("\n❌ ERRORS:")
            for error in self.errors:
                print(f"   {error}")

        # Summary
        print(f"\n📈 SUMMARY:")
        print(f"   ✅ Passed: {len(self.passed_checks)}")
        print(f"   ⚠️  Warnings: {len(self.warnings)}")
        print(f"   ❌ Errors: {len(self.errors)}")

        if self.errors:
            print("\n🔧 Please fix the errors before deploying to production.")
            return False
        elif self.warnings:
            print("\n⚠️  Please review the warnings before deploying to production.")
            return True
        else:
            print("\n🎉 All validation checks passed! Your Mollie integration is ready.")
            return True


async def main():
    """Main validation function."""
    validator = MollieSetupValidator()
    success = await validator.run_validation()

    if not success:
        sys.exit(1)
    else:
        sys.exit(0)


if __name__ == "__main__":
    asyncio.run(main())