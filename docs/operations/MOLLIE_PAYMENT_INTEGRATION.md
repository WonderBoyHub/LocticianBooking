# Mollie Payment Integration Guide

## Overview

This document provides a comprehensive guide for the Mollie payment integration in the JLI Loctician Booking System. The integration supports both one-time payments for bookings and recurring payments for subscriptions.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Installation & Setup](#installation--setup)
4. [Configuration](#configuration)
5. [API Endpoints](#api-endpoints)
6. [Frontend Components](#frontend-components)
7. [Webhook Implementation](#webhook-implementation)
8. [Testing](#testing)
9. [Security Considerations](#security-considerations)
10. [Troubleshooting](#troubleshooting)
11. [Production Deployment](#production-deployment)

## Architecture Overview

The Mollie integration consists of several key components:

### Backend Components
- **Mollie Service** (`app/services/mollie_service.py`): Core service for Mollie API interactions
- **Payment Endpoints** (`app/api/v1/endpoints/payments_mollie.py`): REST API endpoints for payment operations
- **Admin Endpoints** (`app/api/v1/endpoints/admin_payments.py`): Admin interface for payment management
- **Database Schema**: PostgreSQL tables for payments, subscriptions, and customer data
- **Webhook Handler**: Secure webhook processing for real-time payment updates

### Frontend Components
- **SubscriptionPlans.tsx**: Plan selection interface
- **PaymentForm.tsx**: Payment form with Mollie integration
- **SubscriptionDashboard.tsx**: User subscription management
- **PaymentManagement.tsx**: Admin payment management interface

### Database Schema
- `user_payment_customers`: Maps users to Mollie customer IDs
- `payment_intents`: Tracks payment creation through completion
- `refunds`: Manages payment refunds
- `subscription_plans`: Subscription plan definitions
- `user_subscriptions`: User subscription records
- `payment_transactions`: Payment transaction history

## Prerequisites

1. **Mollie Account**: Register at [mollie.com](https://mollie.com)
2. **API Keys**: Obtain test and live API keys from Mollie Dashboard
3. **Webhook Endpoint**: Public URL for webhook notifications
4. **SSL Certificate**: Required for production webhook handling

## Installation & Setup

### 1. Install Dependencies

Add Mollie client to requirements:

```bash
pip install mollie-api-python==3.7.0
```

Or use the provided requirements.txt:

```bash
pip install -r requirements.txt
```

### 2. Database Setup

Run the migration scripts in order:

```bash
# Run PostgreSQL migrations
psql -d your_database -f src/db/010_create_payment_tables.sql
psql -d your_database -f src/db/005_create_subscriptions_table.sql
```

### 3. Environment Configuration

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

## Configuration

### Environment Variables

Add the following variables to your `.env` file:

```env
# Mollie Payment Integration
MOLLIE_API_KEY=test_your-mollie-api-key-here
MOLLIE_WEBHOOK_SECRET=your-mollie-webhook-secret-for-signature-verification
MOLLIE_TEST_MODE=true

# Backend CORS (include your domain)
BACKEND_CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
```

### API Key Configuration

1. **Test Mode**: Use test API key (starts with `test_`) for development
2. **Live Mode**: Use live API key (starts with `live_`) for production
3. **Webhook Secret**: Generate a secure random string for webhook signature verification

### Settings Configuration

The configuration is automatically loaded via `app/core/config.py`:

```python
class Settings(BaseSettings):
    # Mollie Payment Integration
    MOLLIE_API_KEY: Optional[str] = Field(None, description="Mollie API key (test or live)")
    MOLLIE_WEBHOOK_SECRET: Optional[str] = Field(None, description="Mollie webhook secret for signature verification")
    MOLLIE_TEST_MODE: bool = Field(True, description="Whether to use Mollie test mode")
```

## API Endpoints

### Payment Endpoints

#### Create Payment Intent
```http
POST /api/v1/payments/create-intent
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 299.00,
  "currency": "DKK",
  "description": "Subscription payment",
  "payment_type": "subscription",
  "booking_id": "optional-booking-uuid"
}
```

#### Get Payment Status
```http
GET /api/v1/payments/{payment_id}
Authorization: Bearer <token>
```

#### List Payment Methods
```http
GET /api/v1/payments/payment-methods?amount=299&currency=DKK
```

### Customer Management

#### Create Mollie Customer
```http
POST /api/v1/payments/customers/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "metadata": {
    "phone": "+45 12 34 56 78"
  }
}
```

### Subscription Endpoints

#### List Subscription Plans
```http
GET /api/v1/payments/subscriptions/plans?active_only=true
```

#### Create Subscription
```http
POST /api/v1/payments/subscriptions/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "plan_id": "plan-uuid",
  "billing_period": "monthly",
  "trial_period_override": 14
}
```

#### Get User Subscription
```http
GET /api/v1/payments/subscriptions/my-subscription
Authorization: Bearer <token>
```

#### Cancel Subscription
```http
POST /api/v1/payments/subscriptions/{subscription_id}/cancel
Authorization: Bearer <token>
```

### Admin Endpoints

#### Payment Dashboard
```http
GET /api/v1/admin/payments/dashboard
Authorization: Bearer <admin-token>
```

#### Create Refund
```http
POST /api/v1/admin/payments/refunds/{payment_id}/create
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "amount": 100.00,
  "reason": "Customer request"
}
```

## Frontend Components

### SubscriptionPlans Component

Display available subscription plans with pricing:

```tsx
import SubscriptionPlans from './components/payments/SubscriptionPlans';

function PricingPage() {
  const handleSelectPlan = (planId: string, billingPeriod: 'monthly' | 'yearly') => {
    // Handle plan selection
    navigate(`/checkout?plan=${planId}&period=${billingPeriod}`);
  };

  return (
    <SubscriptionPlans
      onSelectPlan={handleSelectPlan}
      currentPlanId={currentUser?.subscription?.plan_id}
    />
  );
}
```

### PaymentForm Component

Secure payment form with Mollie integration:

```tsx
import PaymentForm from './components/payments/PaymentForm';

function CheckoutPage() {
  const handleSuccess = (subscription: any) => {
    // Handle successful payment
    navigate('/dashboard');
  };

  const handleError = (error: string) => {
    // Handle payment error
    console.error('Payment failed:', error);
  };

  return (
    <PaymentForm
      planId="plan-uuid"
      planName="Premium Plan"
      amount={599}
      currency="DKK"
      billingPeriod="monthly"
      trialDays={14}
      onSuccess={handleSuccess}
      onError={handleError}
    />
  );
}
```

### SubscriptionDashboard Component

User subscription management interface:

```tsx
import SubscriptionDashboard from './components/payments/SubscriptionDashboard';

function UserDashboard() {
  return (
    <SubscriptionDashboard
      onUpgrade={() => navigate('/pricing')}
      onManageBilling={() => navigate('/billing')}
      onViewInvoices={() => navigate('/invoices')}
    />
  );
}
```

### Admin PaymentManagement Component

Admin interface for payment management:

```tsx
import PaymentManagement from './components/admin/PaymentManagement';

function AdminPayments() {
  return <PaymentManagement />;
}
```

## Webhook Implementation

### Webhook Security

The webhook handler verifies signatures to ensure authenticity:

```python
def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
    """Verify Mollie webhook signature."""
    if not self.webhook_secret:
        return True  # Skip verification in development

    expected_signature = hmac.new(
        self.webhook_secret.encode('utf-8'),
        payload,
        hashlib.sha256
    ).hexdigest()

    expected_signature = f"sha256={expected_signature}"
    return hmac.compare_digest(signature, expected_signature)
```

### Webhook Endpoint

```http
POST /api/v1/payments/webhook
mollie-signature: sha256=<signature>
Content-Type: application/json

{
  "id": "tr_WDqYK6vllg"
}
```

### Handling Different Webhook Events

The system handles various webhook event types:

- `payment_intent.succeeded`: Payment completed successfully
- `payment_intent.payment_failed`: Payment failed
- `invoice.payment_succeeded`: Invoice paid
- `customer.subscription.updated`: Subscription status changed

## Testing

### Running Tests

```bash
# Run all payment integration tests
pytest tests/test_mollie_integration.py -v

# Run specific test class
pytest tests/test_mollie_integration.py::TestMollieService -v

# Run with coverage
pytest tests/test_mollie_integration.py --cov=app.services.mollie_service
```

### Test Structure

The test suite covers:

1. **Unit Tests**: Mollie service methods
2. **Integration Tests**: API endpoint functionality
3. **Webhook Tests**: Webhook processing and signature verification
4. **Error Handling**: Various error scenarios
5. **Concurrent Processing**: Thread safety validation

### Test Data

Use Mollie test data for testing:

```python
# Test payment IDs
TEST_PAYMENT_ID = "tr_WDqYK6vllg"
TEST_CUSTOMER_ID = "cst_8wmqcHMN4U"
TEST_SUBSCRIPTION_ID = "sub_rVKGtNd6s3"

# Test amounts
TEST_AMOUNTS = ["10.00", "299.00", "599.00", "1199.00"]

# Test cards
TEST_CARD_SUCCESS = "5555 5555 5555 4444"
TEST_CARD_FAILURE = "4000 0000 0000 0002"
```

## Security Considerations

### 1. API Key Security

- Never commit API keys to version control
- Use environment variables for configuration
- Rotate keys regularly
- Use different keys for test and production

### 2. Webhook Security

- Always verify webhook signatures
- Use HTTPS for webhook endpoints
- Implement rate limiting for webhook endpoints
- Log all webhook events for audit purposes

### 3. Data Protection

- Store minimal customer data
- Encrypt sensitive payment information
- Implement GDPR compliance features
- Regular security audits

### 4. PCI Compliance

- Never store card details on your servers
- Use Mollie's hosted payment pages
- Implement secure data transmission
- Regular compliance assessments

## Troubleshooting

### Common Issues

#### 1. Invalid API Key
```
Error: "Invalid API key"
Solution: Check MOLLIE_API_KEY in environment variables
```

#### 2. Webhook Signature Verification Failed
```
Error: "Invalid webhook signature"
Solution: Verify MOLLIE_WEBHOOK_SECRET matches Mollie dashboard
```

#### 3. Payment Method Not Available
```
Error: "Payment method not available for amount"
Solution: Check minimum/maximum amounts for payment methods
```

#### 4. Database Connection Issues
```
Error: "Database connection failed"
Solution: Verify DATABASE_URL and run migrations
```

### Debug Mode

Enable debug logging:

```python
import logging
logging.getLogger('app.services.mollie_service').setLevel(logging.DEBUG)
```

### Health Check

Monitor integration health:

```http
GET /api/v1/payments/health
```

Expected response:
```json
{
  "status": "healthy",
  "mollie_connected": true,
  "organization": "Your Organization",
  "test_mode": true,
  "timestamp": "2025-01-01T12:00:00Z"
}
```

## Production Deployment

### 1. Pre-deployment Checklist

- [ ] Live API keys configured
- [ ] Webhook URL is HTTPS and publicly accessible
- [ ] Database migrations applied
- [ ] SSL certificate installed
- [ ] Environment variables set correctly
- [ ] Tests passing
- [ ] Security review completed

### 2. Mollie Dashboard Configuration

1. **API Keys**: Switch to live API keys
2. **Webhook URL**: Configure production webhook endpoint
3. **Payment Methods**: Enable required payment methods
4. **Organization Settings**: Complete business verification

### 3. Monitoring

Set up monitoring for:

- Payment success/failure rates
- Webhook delivery success
- API response times
- Error rates
- Database performance

### 4. Backup and Recovery

- Regular database backups
- Payment data retention policies
- Disaster recovery procedures
- Business continuity planning

## Support and Resources

### Mollie Documentation
- [Mollie API Documentation](https://docs.mollie.com/)
- [Python Client Library](https://github.com/mollie/mollie-api-python)
- [Webhook Guide](https://docs.mollie.com/docs/webhooks)

### Internal Resources
- Backend API documentation: `/docs` (when DEBUG=true)
- Database schema: `src/db/`
- Test suite: `tests/test_mollie_integration.py`

### Contact
For implementation questions or issues:
1. Check this documentation
2. Review test suite for examples
3. Consult Mollie documentation
4. Contact development team

---

*Last updated: January 2025*
*Version: 1.0.0*