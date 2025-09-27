# Email Service Microservice Architecture

## Service Overview

The Email Service is designed as a standalone microservice that handles all email communications for the Loctician Booking System. It integrates seamlessly with the existing FastAPI backend and PostgreSQL database while providing reliable, scalable email automation.

## Architecture Components

### 1. Email Service Core (FastAPI)
```
email-service/
├── app/
│   ├── core/
│   │   ├── config.py          # Configuration management
│   │   ├── database.py        # Database connections
│   │   ├── security.py        # Authentication/authorization
│   │   └── logging.py         # Structured logging
│   ├── models/
│   │   ├── email_queue.py     # Email queue model (existing)
│   │   ├── email_template.py  # Email template model (existing)
│   │   ├── email_log.py       # Email delivery tracking
│   │   └── email_bounce.py    # Bounce management
│   ├── services/
│   │   ├── email_sender.py    # SMTP/SES integration
│   │   ├── template_engine.py # Jinja2 template rendering
│   │   ├── queue_processor.py # Background job processing
│   │   └── bounce_handler.py  # Bounce/complaint handling
│   ├── api/
│   │   ├── v1/
│   │   │   ├── endpoints/
│   │   │   │   ├── emails.py      # Email sending endpoints
│   │   │   │   ├── templates.py   # Template management
│   │   │   │   ├── campaigns.py   # Marketing campaigns
│   │   │   │   └── webhooks.py    # Provider webhooks
│   │   │   └── router.py
│   │   └── dependencies.py
│   ├── workers/
│   │   ├── email_worker.py    # Celery worker for email processing
│   │   ├── scheduler.py       # Cron job scheduler
│   │   └── monitoring.py      # Health checks and metrics
│   └── utils/
│       ├── validators.py      # Email validation
│       ├── formatters.py      # Content formatting
│       └── gdpr.py           # GDPR compliance utilities
├── templates/
│   ├── booking_confirmation.html
│   ├── appointment_reminder.html
│   ├── cancellation_notice.html
│   ├── welcome_email.html
│   ├── password_reset.html
│   └── marketing_template.html
├── docker/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── requirements.txt
└── deployment/
    ├── kubernetes/
    │   ├── deployment.yaml
    │   ├── service.yaml
    │   ├── configmap.yaml
    │   └── secrets.yaml
    └── monitoring/
        ├── prometheus.yml
        └── grafana-dashboard.json
```

### 2. Database Schema Extensions

The email service leverages existing models and adds new ones:

#### Existing Models (Enhanced)
- **EmailTemplate**: Already defined with template_type, subject, html_content
- **EmailQueue**: Already defined with status tracking and retry logic

#### New Models
```python
# Email delivery tracking
class EmailLog(Base, UUIDMixin):
    email_queue_id: UUID           # Reference to queued email
    provider: str                  # SMTP, SES, SendGrid
    provider_message_id: str       # External ID
    delivery_status: DeliveryStatus
    delivered_at: datetime
    opened_at: datetime           # Email opened tracking
    clicked_at: datetime          # Link click tracking
    bounced_at: datetime
    bounce_reason: str

# Bounce and complaint management
class EmailBounce(Base, UUIDMixin):
    email_address: str
    bounce_type: BounceType        # HARD, SOFT, COMPLAINT
    bounce_subtype: str           # mailbox-full, invalid-address
    bounce_count: int
    last_bounce_at: datetime
    is_suppressed: bool           # Suppression list

# Unsubscribe management
class EmailUnsubscribe(Base, UUIDMixin):
    email_address: str
    unsubscribed_at: datetime
    reason: str
    campaign_id: UUID            # Which campaign triggered unsubscribe
```

### 3. Communication Patterns

#### Synchronous Communication (gRPC)
```python
# email_service.proto
service EmailService {
    // Send immediate emails (booking confirmations)
    rpc SendTransactionalEmail(EmailRequest) returns (EmailResponse);

    // Queue emails for batch processing
    rpc QueueEmail(QueueEmailRequest) returns (QueueResponse);

    // Get email status
    rpc GetEmailStatus(StatusRequest) returns (StatusResponse);

    // Template management
    rpc GetTemplate(TemplateRequest) returns (TemplateResponse);
    rpc ValidateTemplate(TemplateValidationRequest) returns (ValidationResponse);
}
```

#### Asynchronous Communication (Events)
```python
# Event-driven architecture for email triggers
class EmailEvents:
    BOOKING_CREATED = "booking.created"          # Trigger confirmation email
    BOOKING_CONFIRMED = "booking.confirmed"      # Trigger confirmation
    BOOKING_CANCELLED = "booking.cancelled"      # Trigger cancellation notice
    REMINDER_DUE = "reminder.due"               # Trigger reminder
    USER_REGISTERED = "user.registered"         # Trigger welcome email
    PASSWORD_RESET = "auth.password_reset"      # Trigger reset email
```

### 4. Email Provider Integration

#### Multi-Provider Support
```python
class EmailProviderStrategy:
    """Strategy pattern for multiple email providers"""

    def send_email(self, email_data: EmailData) -> SendResult:
        pass

class SMTPProvider(EmailProviderStrategy):
    """Traditional SMTP provider"""

class SESProvider(EmailProviderStrategy):
    """Amazon SES provider"""

class SendGridProvider(EmailProviderStrategy):
    """SendGrid API provider"""
```

#### Provider Configuration
```yaml
email_providers:
  primary: "ses"
  fallback: "smtp"

  ses:
    region: "eu-west-1"
    access_key_id: "${AWS_ACCESS_KEY_ID}"
    secret_access_key: "${AWS_SECRET_ACCESS_KEY}"
    configuration_set: "loctician-emails"

  smtp:
    host: "${SMTP_HOST}"
    port: 587
    username: "${SMTP_USERNAME}"
    password: "${SMTP_PASSWORD}"
    use_tls: true
```

### 5. Template Engine

#### Danish Language Support
```python
class TemplateEngine:
    def __init__(self):
        self.jinja_env = Environment(
            loader=FileSystemLoader('templates'),
            extensions=['jinja2.ext.i18n']
        )
        self.jinja_env.install_gettext_translations(
            self._get_translations()
        )

    def render_template(self, template_name: str, context: dict, locale: str = 'da') -> str:
        template = self.jinja_env.get_template(f"{template_name}_{locale}.html")
        return template.render(**context)
```

#### Template Variables
```python
# Standard template variables
BOOKING_VARIABLES = {
    'customer_name': 'Customer full name',
    'booking_number': 'Unique booking identifier',
    'service_name': 'Booked service name',
    'appointment_datetime': 'Appointment date and time',
    'loctician_name': 'Assigned loctician name',
    'total_amount': 'Total booking amount',
    'booking_url': 'Link to view booking details',
    'cancellation_url': 'Link to cancel booking'
}
```

### 6. Queue Processing with Celery

#### Celery Configuration
```python
# celery_config.py
CELERY_CONFIG = {
    'broker_url': 'redis://redis:6379/1',
    'result_backend': 'redis://redis:6379/1',
    'task_serializer': 'json',
    'accept_content': ['json'],
    'result_serializer': 'json',
    'timezone': 'Europe/Copenhagen',
    'enable_utc': True,
    'task_routes': {
        'email_service.tasks.send_email': {'queue': 'email_high'},
        'email_service.tasks.send_reminder': {'queue': 'email_medium'},
        'email_service.tasks.send_marketing': {'queue': 'email_low'},
    }
}
```

#### Task Definitions
```python
@celery_app.task(bind=True, max_retries=3)
def send_email_task(self, email_queue_id: str):
    try:
        email_service = EmailSenderService()
        result = email_service.send_queued_email(email_queue_id)
        return result
    except Exception as exc:
        # Exponential backoff retry
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))

@celery_app.task
def process_bounces():
    """Process bounce notifications from email providers"""
    bounce_processor = BounceProcessor()
    bounce_processor.process_pending_bounces()

@celery_app.task
def send_scheduled_reminders():
    """Send appointment reminders"""
    reminder_service = ReminderService()
    reminder_service.process_due_reminders()
```

### 7. Monitoring and Observability

#### Metrics Collection
```python
from prometheus_client import Counter, Histogram, Gauge

# Email metrics
emails_sent_total = Counter('emails_sent_total', 'Total emails sent', ['provider', 'template_type'])
emails_failed_total = Counter('emails_failed_total', 'Total failed emails', ['provider', 'reason'])
email_send_duration = Histogram('email_send_duration_seconds', 'Email send duration')
email_queue_size = Gauge('email_queue_size', 'Current email queue size')
bounce_rate = Gauge('email_bounce_rate', 'Email bounce rate percentage')
```

#### Health Checks
```python
class EmailServiceHealth:
    async def check_database(self) -> bool:
        """Check database connectivity"""

    async def check_email_provider(self) -> bool:
        """Check email provider connectivity"""

    async def check_queue_processing(self) -> bool:
        """Check if queue is being processed"""

    async def check_template_rendering(self) -> bool:
        """Validate template rendering"""
```

### 8. Security and Compliance

#### GDPR Compliance
```python
class GDPRCompliance:
    def anonymize_email_data(self, user_id: str):
        """Anonymize email data when user requests deletion"""

    def export_email_data(self, user_id: str) -> dict:
        """Export user's email data for GDPR requests"""

    def apply_marketing_consent(self, email: str, consent: bool):
        """Apply marketing email consent"""
```

#### Rate Limiting
```python
class EmailRateLimiter:
    def __init__(self):
        self.redis_client = Redis()

    def can_send_email(self, email_address: str, email_type: str) -> bool:
        """Check if email can be sent based on rate limits"""
        # Per-recipient limits: max 5 emails per hour
        # Marketing emails: max 1 per day
        # Transactional: no limit
```

### 9. API Endpoints

#### Email Sending API
```python
@router.post("/emails/send", response_model=EmailResponse)
async def send_email(
    email_request: EmailRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send transactional email immediately"""

@router.post("/emails/queue", response_model=QueueResponse)
async def queue_email(
    queue_request: QueueEmailRequest,
    db: AsyncSession = Depends(get_db)
):
    """Queue email for batch processing"""

@router.get("/emails/{email_id}/status", response_model=EmailStatusResponse)
async def get_email_status(
    email_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get email delivery status"""
```

#### Template Management API
```python
@router.get("/templates", response_model=List[EmailTemplateResponse])
async def list_templates(
    template_type: Optional[TemplateType] = None,
    db: AsyncSession = Depends(get_db)
):
    """List available email templates"""

@router.post("/templates/validate", response_model=ValidationResponse)
async def validate_template(
    template_data: TemplateValidationRequest,
    db: AsyncSession = Depends(get_db)
):
    """Validate template syntax and variables"""
```

## Integration with Main System

### 1. Event-Driven Integration
```python
# In the main booking service
class BookingEventEmitter:
    def emit_booking_created(self, booking: Booking):
        event = {
            'event_type': 'booking.created',
            'booking_id': booking.id,
            'customer_email': booking.customer.email,
            'template_variables': {
                'customer_name': booking.customer.full_name,
                'booking_number': booking.booking_number,
                'service_name': booking.service.name,
                'appointment_datetime': booking.appointment_start,
                'loctician_name': booking.loctician.full_name,
                'total_amount': booking.total_amount
            }
        }
        # Publish to message queue or call email service directly
        email_service.queue_template_email(
            template_type='booking_confirmation',
            recipient=booking.customer.email,
            variables=event['template_variables']
        )
```

### 2. Database Integration
The email service shares the same PostgreSQL database but uses separate schemas for isolation:
- `public` schema: Main application tables
- `email` schema: Email service specific tables

### 3. Authentication Integration
The email service integrates with the main system's JWT authentication for administrative endpoints while allowing internal service-to-service communication via API keys.

## Deployment Strategy

### Docker Configuration
```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8001

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
```

### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: email-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: email-service
  template:
    metadata:
      labels:
        app: email-service
    spec:
      containers:
      - name: email-service
        image: loctician/email-service:latest
        ports:
        - containerPort: 8001
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: email-service-secrets
              key: database-url
        - name: REDIS_URL
          value: "redis://redis:6379/1"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

This email service architecture provides a robust, scalable solution that integrates seamlessly with your existing FastAPI backend while offering comprehensive email automation capabilities with Danish language support and GDPR compliance.