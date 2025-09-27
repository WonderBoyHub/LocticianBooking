"""
Invoice Generation and Management Service
Handles invoice creation, PDF generation, and tracking for subscriptions and bookings.
"""
import os
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Any
from uuid import UUID

import structlog
from jinja2 import Environment, FileSystemLoader
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from weasyprint import HTML, CSS

from app.core.config import settings
from app.schemas.subscription_extended import Invoice, InvoiceItem, InvoiceCreate

logger = structlog.get_logger(__name__)


class InvoiceService:
    """Service for generating and managing invoices."""

    def __init__(self):
        """Initialize invoice service with templates."""
        # Setup Jinja2 environment for invoice templates
        template_dir = os.path.join(os.path.dirname(__file__), '..', 'templates', 'invoices')
        os.makedirs(template_dir, exist_ok=True)

        self.env = Environment(
            loader=FileSystemLoader(template_dir),
            autoescape=True
        )

        # Invoice settings
        self.invoice_settings = {
            'company_name': getattr(settings, 'COMPANY_NAME', 'JLI Booking System'),
            'company_address': getattr(settings, 'COMPANY_ADDRESS', 'Copenhagen, Denmark'),
            'company_vat': getattr(settings, 'COMPANY_VAT', 'DK12345678'),
            'company_email': getattr(settings, 'COMPANY_EMAIL', 'billing@jli.dk'),
            'company_phone': getattr(settings, 'COMPANY_PHONE', '+45 12 34 56 78'),
            'logo_url': getattr(settings, 'COMPANY_LOGO_URL', None),
            'currency': 'DKK',
            'tax_rate': Decimal('25.0'),  # Danish VAT rate
        }

        logger.info("Invoice service initialized", template_dir=template_dir)

    async def create_subscription_invoice(
        self,
        subscription_id: UUID,
        period_start: datetime,
        period_end: datetime,
        db: AsyncSession,
        due_days: int = 14
    ) -> Invoice:
        """Create an invoice for a subscription billing period."""
        try:
            # Get subscription details
            subscription_query = await db.execute(
                text("""
                    SELECT
                        us.id as subscription_id,
                        us.user_id,
                        us.plan_price,
                        us.currency,
                        us.billing_period,
                        sp.name as plan_name,
                        sp.description as plan_description,
                        u.first_name,
                        u.last_name,
                        u.email,
                        u.street_address,
                        u.city,
                        u.postal_code,
                        u.country
                    FROM user_subscriptions us
                    JOIN subscription_plans sp ON us.plan_id = sp.id
                    JOIN users u ON us.user_id = u.id
                    WHERE us.id = :subscription_id::uuid
                """),
                {"subscription_id": subscription_id}
            )

            subscription = subscription_query.first()
            if not subscription:
                raise ValueError(f"Subscription {subscription_id} not found")

            # Calculate amounts
            subtotal = subscription.plan_price
            tax_amount = subtotal * (self.invoice_settings['tax_rate'] / 100)
            total_amount = subtotal + tax_amount

            # Create line items
            line_items = [
                {
                    "description": f"{subscription.plan_name} Subscription",
                    "period": f"{period_start.strftime('%Y-%m-%d')} to {period_end.strftime('%Y-%m-%d')}",
                    "quantity": 1,
                    "unit_price": float(subtotal),
                    "total_price": float(subtotal),
                    "tax_rate": float(self.invoice_settings['tax_rate'])
                }
            ]

            # Set due date
            due_date = datetime.utcnow() + timedelta(days=due_days)

            # Create invoice record
            invoice_id = await db.execute(
                text("""
                    INSERT INTO subscription_invoices (
                        id, subscription_id, user_id, amount_due, tax_amount, total_amount,
                        currency, status, period_start, period_end, due_date,
                        issued_at, line_items, created_at
                    ) VALUES (
                        gen_random_uuid(), :subscription_id::uuid, :user_id::uuid,
                        :amount_due, :tax_amount, :total_amount, :currency, 'open',
                        :period_start, :period_end, :due_date, NOW(), :line_items::jsonb, NOW()
                    ) RETURNING id, invoice_number
                """),
                {
                    "subscription_id": subscription_id,
                    "user_id": subscription.user_id,
                    "amount_due": subtotal,
                    "tax_amount": tax_amount,
                    "total_amount": total_amount,
                    "currency": subscription.currency,
                    "period_start": period_start,
                    "period_end": period_end,
                    "due_date": due_date,
                    "line_items": line_items
                }
            )

            result = invoice_id.first()
            invoice_uuid = result.id
            invoice_number = result.invoice_number

            await db.commit()

            logger.info(
                "Subscription invoice created",
                invoice_id=invoice_uuid,
                invoice_number=invoice_number,
                subscription_id=subscription_id,
                total_amount=float(total_amount)
            )

            # Create Invoice object
            invoice = Invoice(
                id=invoice_uuid,
                subscription_id=subscription_id,
                user_id=subscription.user_id,
                invoice_number=invoice_number,
                subtotal=subtotal,
                tax_amount=tax_amount,
                total_amount=total_amount,
                currency=subscription.currency,
                status="open",
                due_date=due_date,
                issued_at=datetime.utcnow(),
                period_start=period_start,
                period_end=period_end,
                line_items=line_items,
                created_at=datetime.utcnow()
            )

            return invoice

        except Exception as e:
            logger.error("Failed to create subscription invoice", error=str(e), subscription_id=subscription_id)
            raise

    async def create_booking_invoice(
        self,
        booking_id: UUID,
        db: AsyncSession,
        additional_services: List[Dict[str, Any]] = None,
        products: List[Dict[str, Any]] = None
    ) -> Invoice:
        """Create an invoice for a booking with optional additional services and products."""
        try:
            # Get booking details
            booking_query = await db.execute(
                text("""
                    SELECT
                        b.id as booking_id,
                        b.customer_id as user_id,
                        b.service_price,
                        b.total_amount,
                        b.appointment_start,
                        s.name as service_name,
                        s.description as service_description,
                        u.first_name,
                        u.last_name,
                        u.email,
                        u.street_address,
                        u.city,
                        u.postal_code,
                        u.country
                    FROM bookings b
                    JOIN services s ON b.service_id = s.id
                    JOIN users u ON b.customer_id = u.id
                    WHERE b.id = :booking_id::uuid
                """),
                {"booking_id": booking_id}
            )

            booking = booking_query.first()
            if not booking:
                raise ValueError(f"Booking {booking_id} not found")

            # Build line items
            line_items = [
                {
                    "description": booking.service_name,
                    "details": booking.service_description or "",
                    "appointment_date": booking.appointment_start.strftime('%Y-%m-%d %H:%M'),
                    "quantity": 1,
                    "unit_price": float(booking.service_price),
                    "total_price": float(booking.service_price),
                    "tax_rate": float(self.invoice_settings['tax_rate'])
                }
            ]

            subtotal = booking.service_price

            # Add additional services
            if additional_services:
                for service in additional_services:
                    line_items.append({
                        "description": service['name'],
                        "details": service.get('description', ''),
                        "quantity": service.get('quantity', 1),
                        "unit_price": float(service['price']),
                        "total_price": float(service['price'] * service.get('quantity', 1)),
                        "tax_rate": float(self.invoice_settings['tax_rate'])
                    })
                    subtotal += Decimal(str(service['price'] * service.get('quantity', 1)))

            # Add products
            if products:
                for product in products:
                    line_items.append({
                        "description": f"Product: {product['name']}",
                        "details": product.get('description', ''),
                        "quantity": product.get('quantity', 1),
                        "unit_price": float(product['price']),
                        "total_price": float(product['price'] * product.get('quantity', 1)),
                        "tax_rate": float(self.invoice_settings['tax_rate'])
                    })
                    subtotal += Decimal(str(product['price'] * product.get('quantity', 1)))

            # Calculate tax and total
            tax_amount = subtotal * (self.invoice_settings['tax_rate'] / 100)
            total_amount = subtotal + tax_amount

            # Create invoice record
            invoice_id = await db.execute(
                text("""
                    INSERT INTO booking_invoices (
                        id, booking_id, user_id, amount_due, tax_amount, total_amount,
                        currency, status, due_date, issued_at, line_items, created_at
                    ) VALUES (
                        gen_random_uuid(), :booking_id::uuid, :user_id::uuid,
                        :amount_due, :tax_amount, :total_amount, 'DKK', 'open',
                        NOW(), NOW(), :line_items::jsonb, NOW()
                    ) RETURNING id, invoice_number
                """),
                {
                    "booking_id": booking_id,
                    "user_id": booking.user_id,
                    "amount_due": subtotal,
                    "tax_amount": tax_amount,
                    "total_amount": total_amount,
                    "line_items": line_items
                }
            )

            result = invoice_id.first()
            invoice_uuid = result.id
            invoice_number = result.invoice_number

            await db.commit()

            logger.info(
                "Booking invoice created",
                invoice_id=invoice_uuid,
                invoice_number=invoice_number,
                booking_id=booking_id,
                total_amount=float(total_amount)
            )

            # Create Invoice object
            invoice = Invoice(
                id=invoice_uuid,
                subscription_id=None,
                user_id=booking.user_id,
                invoice_number=invoice_number,
                subtotal=subtotal,
                tax_amount=tax_amount,
                total_amount=total_amount,
                currency="DKK",
                status="open",
                due_date=datetime.utcnow(),  # Immediate payment for bookings
                issued_at=datetime.utcnow(),
                period_start=booking.appointment_start,
                period_end=booking.appointment_start,
                line_items=line_items,
                created_at=datetime.utcnow()
            )

            return invoice

        except Exception as e:
            logger.error("Failed to create booking invoice", error=str(e), booking_id=booking_id)
            raise

    async def generate_invoice_pdf(
        self,
        invoice: Invoice,
        db: AsyncSession,
        template_name: str = "invoice_template.html"
    ) -> bytes:
        """Generate PDF for an invoice."""
        try:
            # Get customer details
            customer_query = await db.execute(
                text("""
                    SELECT first_name, last_name, email, street_address, city, postal_code, country
                    FROM users WHERE id = :user_id::uuid
                """),
                {"user_id": invoice.user_id}
            )
            customer = customer_query.first()

            if not customer:
                raise ValueError(f"Customer {invoice.user_id} not found")

            # Prepare template data
            template_data = {
                'invoice': {
                    'number': invoice.invoice_number,
                    'date': invoice.issued_at.strftime('%Y-%m-%d'),
                    'due_date': invoice.due_date.strftime('%Y-%m-%d') if invoice.due_date else None,
                    'subtotal': float(invoice.subtotal),
                    'tax_amount': float(invoice.tax_amount),
                    'total_amount': float(invoice.total_amount),
                    'currency': invoice.currency,
                    'status': invoice.status,
                    'line_items': invoice.line_items
                },
                'customer': {
                    'name': f"{customer.first_name} {customer.last_name}",
                    'email': customer.email,
                    'address': customer.street_address,
                    'city': customer.city,
                    'postal_code': customer.postal_code,
                    'country': customer.country
                },
                'company': self.invoice_settings,
                'generated_at': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
            }

            # Load and render template
            try:
                template = self.env.get_template(template_name)
            except Exception:
                # Use default template if custom template not found
                template_content = self._get_default_invoice_template()
                template = self.env.from_string(template_content)

            html_content = template.render(**template_data)

            # Generate PDF
            pdf_bytes = HTML(string=html_content).write_pdf(
                stylesheets=[CSS(string=self._get_default_invoice_css())]
            )

            logger.info("Invoice PDF generated", invoice_id=invoice.id, size_bytes=len(pdf_bytes))

            return pdf_bytes

        except Exception as e:
            logger.error("Failed to generate invoice PDF", error=str(e), invoice_id=invoice.id)
            raise

    async def mark_invoice_paid(
        self,
        invoice_id: UUID,
        payment_transaction_id: UUID,
        db: AsyncSession
    ) -> None:
        """Mark an invoice as paid."""
        try:
            await db.execute(
                text("""
                    UPDATE subscription_invoices
                    SET status = 'paid', paid_at = NOW(), payment_transaction_id = :payment_transaction_id::uuid
                    WHERE id = :invoice_id::uuid
                """),
                {"invoice_id": invoice_id, "payment_transaction_id": payment_transaction_id}
            )

            # Also try booking invoices table
            await db.execute(
                text("""
                    UPDATE booking_invoices
                    SET status = 'paid', paid_at = NOW(), payment_transaction_id = :payment_transaction_id::uuid
                    WHERE id = :invoice_id::uuid
                """),
                {"invoice_id": invoice_id, "payment_transaction_id": payment_transaction_id}
            )

            await db.commit()

            logger.info("Invoice marked as paid", invoice_id=invoice_id, payment_transaction_id=payment_transaction_id)

        except Exception as e:
            logger.error("Failed to mark invoice as paid", error=str(e), invoice_id=invoice_id)
            raise

    async def void_invoice(self, invoice_id: UUID, reason: str, db: AsyncSession) -> None:
        """Void an invoice."""
        try:
            await db.execute(
                text("""
                    UPDATE subscription_invoices
                    SET status = 'void', voided_at = NOW(), notes = :reason
                    WHERE id = :invoice_id::uuid AND status != 'paid'
                """),
                {"invoice_id": invoice_id, "reason": reason}
            )

            # Also try booking invoices table
            await db.execute(
                text("""
                    UPDATE booking_invoices
                    SET status = 'void', voided_at = NOW(), notes = :reason
                    WHERE id = :invoice_id::uuid AND status != 'paid'
                """),
                {"invoice_id": invoice_id, "reason": reason}
            )

            await db.commit()

            logger.info("Invoice voided", invoice_id=invoice_id, reason=reason)

        except Exception as e:
            logger.error("Failed to void invoice", error=str(e), invoice_id=invoice_id)
            raise

    def _get_default_invoice_template(self) -> str:
        """Get default HTML template for invoices."""
        return """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice {{ invoice.number }}</title>
</head>
<body>
    <div class="invoice">
        <header class="invoice-header">
            <div class="company-info">
                {% if company.logo_url %}
                <img src="{{ company.logo_url }}" alt="{{ company.company_name }}" class="company-logo">
                {% endif %}
                <h1>{{ company.company_name }}</h1>
                <p>{{ company.company_address }}</p>
                <p>VAT: {{ company.company_vat }}</p>
                <p>Email: {{ company.company_email }}</p>
                <p>Phone: {{ company.company_phone }}</p>
            </div>
            <div class="invoice-info">
                <h2>INVOICE</h2>
                <p><strong>Invoice #:</strong> {{ invoice.number }}</p>
                <p><strong>Date:</strong> {{ invoice.date }}</p>
                {% if invoice.due_date %}
                <p><strong>Due Date:</strong> {{ invoice.due_date }}</p>
                {% endif %}
                <p><strong>Status:</strong> {{ invoice.status|upper }}</p>
            </div>
        </header>

        <div class="bill-to">
            <h3>Bill To:</h3>
            <p><strong>{{ customer.name }}</strong></p>
            <p>{{ customer.email }}</p>
            {% if customer.address %}
            <p>{{ customer.address }}</p>
            <p>{{ customer.city }}, {{ customer.postal_code }}</p>
            <p>{{ customer.country }}</p>
            {% endif %}
        </div>

        <table class="invoice-items">
            <thead>
                <tr>
                    <th>Description</th>
                    <th>Quantity</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                {% for item in invoice.line_items %}
                <tr>
                    <td>
                        <strong>{{ item.description }}</strong>
                        {% if item.details %}
                        <br><small>{{ item.details }}</small>
                        {% endif %}
                        {% if item.period %}
                        <br><small>Period: {{ item.period }}</small>
                        {% endif %}
                        {% if item.appointment_date %}
                        <br><small>Date: {{ item.appointment_date }}</small>
                        {% endif %}
                    </td>
                    <td>{{ item.quantity }}</td>
                    <td>{{ "%.2f"|format(item.unit_price) }} {{ invoice.currency }}</td>
                    <td>{{ "%.2f"|format(item.total_price) }} {{ invoice.currency }}</td>
                </tr>
                {% endfor %}
            </tbody>
        </table>

        <div class="invoice-totals">
            <div class="totals-row">
                <span>Subtotal:</span>
                <span>{{ "%.2f"|format(invoice.subtotal) }} {{ invoice.currency }}</span>
            </div>
            <div class="totals-row">
                <span>VAT (25%):</span>
                <span>{{ "%.2f"|format(invoice.tax_amount) }} {{ invoice.currency }}</span>
            </div>
            <div class="totals-row total">
                <span><strong>Total:</strong></span>
                <span><strong>{{ "%.2f"|format(invoice.total_amount) }} {{ invoice.currency }}</strong></span>
            </div>
        </div>

        <footer class="invoice-footer">
            <p>Thank you for your business!</p>
            <p><small>Generated on {{ generated_at }}</small></p>
        </footer>
    </div>
</body>
</html>
        """

    def _get_default_invoice_css(self) -> str:
        """Get default CSS styles for invoices."""
        return """
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            color: #333;
        }

        .invoice {
            max-width: 800px;
            margin: 0 auto;
            background: white;
        }

        .invoice-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #eee;
        }

        .company-info h1 {
            margin: 0 0 10px 0;
            color: #2c3e50;
        }

        .company-info p, .invoice-info p {
            margin: 5px 0;
        }

        .invoice-info {
            text-align: right;
        }

        .invoice-info h2 {
            margin: 0 0 15px 0;
            color: #2c3e50;
            font-size: 24px;
        }

        .company-logo {
            max-width: 150px;
            margin-bottom: 10px;
        }

        .bill-to {
            margin-bottom: 30px;
        }

        .bill-to h3 {
            margin: 0 0 10px 0;
            color: #2c3e50;
        }

        .bill-to p {
            margin: 3px 0;
        }

        .invoice-items {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
        }

        .invoice-items th {
            background-color: #f8f9fa;
            padding: 12px;
            text-align: left;
            border-bottom: 2px solid #dee2e6;
            font-weight: bold;
        }

        .invoice-items td {
            padding: 12px;
            border-bottom: 1px solid #dee2e6;
        }

        .invoice-items tr:hover {
            background-color: #f8f9fa;
        }

        .invoice-totals {
            float: right;
            width: 300px;
        }

        .totals-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
        }

        .totals-row.total {
            border-bottom: 2px solid #2c3e50;
            border-top: 2px solid #2c3e50;
            font-size: 18px;
            margin-top: 10px;
            padding-top: 15px;
        }

        .invoice-footer {
            clear: both;
            margin-top: 50px;
            text-align: center;
            padding-top: 20px;
            border-top: 1px solid #eee;
        }

        small {
            color: #666;
            font-size: 12px;
        }

        @media print {
            body {
                padding: 0;
            }

            .invoice {
                box-shadow: none;
            }
        }
        """


# Global service instance
invoice_service = InvoiceService()