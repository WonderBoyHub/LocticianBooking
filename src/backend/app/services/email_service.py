"""Email delivery and templating utilities for the Loctician Booking System."""
import asyncio
import json
import re
import textwrap
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Tuple

import aiosmtplib
import structlog
from jinja2 import BaseLoader, Environment
from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db_session
from app.models.booking import Booking
from app.models.email_template import EmailQueue, EmailTemplate
from app.models.enums import BookingStatus, EmailStatus, TemplateType
from app.models.user import User

try:
    import sib_api_v3_sdk
    from sib_api_v3_sdk.rest import ApiException as BrevoApiException
except Exception:  # pragma: no cover - optional dependency
    sib_api_v3_sdk = None
    BrevoApiException = Exception

logger = structlog.get_logger(__name__)


def _dedent(text: str) -> str:
    """Return normalized template text without leading indentation."""

    return textwrap.dedent(text).strip()


DEFAULT_TEMPLATES: Dict[TemplateType, Dict[str, Any]] = {
    TemplateType.BOOKING_CONFIRMATION: {
        "name": "Booking Confirmation",
        "subject": "Booking bekræftet – {{booking_number}}",
        "html_content": _dedent(
            """
            <h2>Booking bekræftet</h2>
            <p>Kære {{customer_name}},</p>
            <p>Din tid er nu bekræftet:</p>
            <ul>
              <li><strong>Service:</strong> {{service_name}}</li>
              <li><strong>Dato & tidspunkt:</strong> {{appointment_date}} kl. {{appointment_time}}</li>
              <li><strong>Varighed:</strong> {{duration}} minutter</li>
              <li><strong>Loctician:</strong> {{loctician_name}}</li>
              <li><strong>Pris:</strong> {{total_amount}} DKK</li>
            </ul>
            <p>Vi glæder os til at se dig. Kom gerne 15 minutter før din tid.</p>
            <p>Varme hilsner,<br>{{business_name}}</p>
            """
        ),
        "text_content": _dedent(
            """
            Booking bekræftet – {{booking_number}}

            Kære {{customer_name}},

            Din tid er nu bekræftet:
            - Service: {{service_name}}
            - Dato & tidspunkt: {{appointment_date}} kl. {{appointment_time}}
            - Varighed: {{duration}} minutter
            - Loctician: {{loctician_name}}
            - Pris: {{total_amount}} DKK

            Vi glæder os til at se dig. Kom gerne 15 minutter før din tid.

            Varme hilsner,
            {{business_name}}
            """
        ),
        "available_variables": {
            "customer_name": "Kundens fulde navn",
            "booking_number": "Bookingreference",
            "service_name": "Navn på booket service",
            "appointment_date": "Dato",
            "appointment_time": "Tidspunkt",
            "duration": "Varighed i minutter",
            "loctician_name": "Locticians navn",
            "total_amount": "Pris",
            "business_name": "Virksomhedsnavn",
        },
    },
    TemplateType.REMINDER: {
        "name": "Appointment Reminder",
        "subject": "Påmindelse: Din aftale i morgen – {{booking_number}}",
        "html_content": _dedent(
            """
            <h2>Vi ses snart!</h2>
            <p>Kære {{customer_name}},</p>
            <p>Dette er en venlig påmindelse om din aftale i morgen:</p>
            <ul>
              <li><strong>Service:</strong> {{service_name}}</li>
              <li><strong>Dato & tidspunkt:</strong> {{appointment_date}} kl. {{appointment_time}}</li>
              <li><strong>Loctician:</strong> {{loctician_name}}</li>
            </ul>
            <p>Har du særlige ønsker, så giv os endelig besked.</p>
            <p>Bedste hilsner,<br>{{business_name}}</p>
            """
        ),
        "text_content": _dedent(
            """
            Påmindelse: Din aftale i morgen – {{booking_number}}

            Kære {{customer_name}},

            Dette er en venlig påmindelse om din aftale i morgen:
            - Service: {{service_name}}
            - Dato & tidspunkt: {{appointment_date}} kl. {{appointment_time}}
            - Loctician: {{loctician_name}}

            Har du særlige ønsker, så giv os endelig besked.

            Bedste hilsner,
            {{business_name}}
            """
        ),
        "available_variables": {
            "customer_name": "Kundens fulde navn",
            "booking_number": "Bookingreference",
            "service_name": "Navn på booket service",
            "appointment_date": "Dato",
            "appointment_time": "Tidspunkt",
            "loctician_name": "Locticians navn",
            "business_name": "Virksomhedsnavn",
        },
    },
    TemplateType.CANCELLATION: {
        "name": "Booking Cancellation",
        "subject": "Din booking er aflyst – {{booking_number}}",
        "html_content": _dedent(
            """
            <h2>Booking aflyst</h2>
            <p>Kære {{customer_name}},</p>
            <p>Vi bekræfter hermed, at din booking {{booking_number}} er aflyst.</p>
            <p><strong>Årsag:</strong> {{cancellation_reason}}</p>
            <p>Kontakt os gerne, hvis du ønsker at booke en ny tid.</p>
            <p>Venlig hilsen,<br>{{business_name}}</p>
            """
        ),
        "text_content": _dedent(
            """
            Din booking er aflyst – {{booking_number}}

            Kære {{customer_name}},

            Vi bekræfter hermed, at din booking {{booking_number}} er aflyst.
            Årsag: {{cancellation_reason}}

            Kontakt os gerne, hvis du ønsker at booke en ny tid.

            Venlig hilsen,
            {{business_name}}
            """
        ),
        "available_variables": {
            "customer_name": "Kundens fulde navn",
            "booking_number": "Bookingreference",
            "cancellation_reason": "Aflysningsårsag",
            "business_name": "Virksomhedsnavn",
        },
    },
    TemplateType.MARKETING: {
        "name": "Marketing Inspiration",
        "subject": "EKSKLUSIVE OPDATERINGER – Nyheder fra dit loctician team",
        "html_content": _dedent(
            """
            <h1>EKSKLUSIVE OPDATERINGER</h1>
            <p><strong>Hold dig opdateret</strong></p>
            <p>Få de seneste tips, trends og særlige tilbud direkte i din indbakke. Vi lover kun inspirerende hårpleje.</p>
            <p>{{custom_message}}</p>
            <p><em>{{special_offer}}</em></p>
            <p><a href="{{cta_url}}" style="color:#a67c52; font-weight:bold;">{{cta_label}}</a></p>
            <p>Tak fordi du er en del af vores community.<br>{{business_name}}</p>
            """
        ),
        "text_content": _dedent(
            """
            EKSKLUSIVE OPDATERINGER

            Hold dig opdateret

            Få de seneste tips, trends og særlige tilbud direkte i din indbakke. Vi lover kun inspirerende hårpleje.

            {{custom_message}}

            {{special_offer}}

            Læs mere: {{cta_url}}

            Tak fordi du er en del af vores community.
            {{business_name}}
            """
        ),
        "available_variables": {
            "custom_message": "Valgfri ekstra besked",
            "special_offer": "Eventuel kampagne",
            "cta_label": "Tekst til call-to-action",
            "cta_url": "Link til kampagne",
            "business_name": "Virksomhedsnavn",
        },
    },
    TemplateType.CONTACT: {
        "name": "Kontaktbesked",
        "subject": "Ny kontaktforespørgsel fra {{sender_name}}",
        "html_content": _dedent(
            """
            <h2>Ny kontaktforespørgsel</h2>
            <p><strong>Navn:</strong> {{sender_name}}</p>
            <p><strong>Email:</strong> {{sender_email}}</p>
            <p><strong>Telefon:</strong> {{sender_phone}}</p>
            <p><strong>Emne:</strong> {{topic}}</p>
            <p>{{message_body}}</p>
            """
        ),
        "text_content": _dedent(
            """
            Ny kontaktforespørgsel

            Navn: {{sender_name}}
            Email: {{sender_email}}
            Telefon: {{sender_phone}}
            Emne: {{topic}}

            {{message_body}}
            """
        ),
        "available_variables": {
            "sender_name": "Afsenders navn",
            "sender_email": "Afsenders email",
            "sender_phone": "Telefonnummer",
            "topic": "Emne",
            "message_body": "Selve beskeden",
        },
    },
    TemplateType.ADMIN_NOTIFICATION: {
        "name": "Intern admin notifikation",
        "subject": "Administrativ hændelse: {{subject}}",
        "html_content": _dedent(
            """
            <h2>Administrativ notifikation</h2>
            <p>{{subject}}</p>
            <p>{{message_body}}</p>
            <p><strong>Dato:</strong> {{timestamp}}</p>
            <p><strong>Detaljer:</strong></p>
            <pre>{{metadata}}</pre>
            """
        ),
        "text_content": _dedent(
            """
            Administrativ notifikation

            {{subject}}

            {{message_body}}

            Dato: {{timestamp}}
            Detaljer:
            {{metadata}}
            """
        ),
        "available_variables": {
            "subject": "Kort overskrift",
            "message_body": "Notifikationstekst",
            "timestamp": "Tidspunkt",
            "metadata": "Supplerende information",
        },
    },
    TemplateType.STAFF_NOTIFICATION: {
        "name": "Intern staff notifikation",
        "subject": "Teamopdatering: {{subject}}",
        "html_content": _dedent(
            """
            <h2>Teamopdatering</h2>
            <p>{{subject}}</p>
            <p>{{message_body}}</p>
            <p><strong>Dato:</strong> {{timestamp}}</p>
            <p>Kontakt admin ved spørgsmål.</p>
            """
        ),
        "text_content": _dedent(
            """
            Teamopdatering

            {{subject}}

            {{message_body}}

            Dato: {{timestamp}}
            Kontakt admin ved spørgsmål.
            """
        ),
        "available_variables": {
            "subject": "Kort overskrift",
            "message_body": "Notifikationstekst",
            "timestamp": "Tidspunkt",
        },
    },
    TemplateType.WELCOME: {
        "name": "Velkomst",
        "subject": "Velkommen til Loctician Booking, {{customer_first_name}}",
        "html_content": _dedent(
            """
            <h2>Velkommen!</h2>
            <p>Kære {{customer_first_name}},</p>
            <p>Tak fordi du har oprettet en konto hos os. Vi glæder os til at passe på dine locs.</p>
            <p>Kh,<br>{{business_name}}</p>
            """
        ),
        "text_content": _dedent(
            """
            Velkommen!

            Kære {{customer_first_name}},

            Tak fordi du har oprettet en konto hos os. Vi glæder os til at passe på dine locs.

            Kh,
            {{business_name}}
            """
        ),
        "available_variables": {
            "customer_first_name": "Fornavn",
            "business_name": "Virksomhedsnavn",
        },
    },
    TemplateType.PASSWORD_RESET: {
        "name": "Password Reset",
        "subject": "Nulstil din adgangskode",
        "html_content": _dedent(
            """
            <h2>Nulstil adgangskode</h2>
            <p>Kære {{customer_name}},</p>
            <p>Vi har modtaget en anmodning om at nulstille din adgangskode. Brug linket herunder:</p>
            <p><a href="{{reset_url}}">Nulstil adgangskode</a></p>
            <p>Hvis du ikke har anmodet om dette, kan du ignorere mailen.</p>
            """
        ),
        "text_content": _dedent(
            """
            Nulstil adgangskode

            Kære {{customer_name}},

            Vi har modtaget en anmodning om at nulstille din adgangskode. Brug linket herunder:
            {{reset_url}}

            Hvis du ikke har anmodet om dette, kan du ignorere mailen.
            """
        ),
        "available_variables": {
            "customer_name": "Kundens navn",
            "reset_url": "Link til nulstilling",
        },
    },
    TemplateType.INVOICE: {
        "name": "Faktura",
        "subject": "Din faktura er klar – {{invoice_number}}",
        "html_content": _dedent(
            """
            <h2>Din faktura er klar</h2>
            <p>Kære {{customer_name}},</p>
            <p>Tak for dit besøg. Din faktura {{invoice_number}} er vedhæftet eller kan downloades via din konto.</p>
            <p>Beløb: {{total_amount}} DKK</p>
            <p>Kh,<br>{{business_name}}</p>
            """
        ),
        "text_content": _dedent(
            """
            Din faktura er klar – {{invoice_number}}

            Kære {{customer_name}},

            Tak for dit besøg. Din faktura {{invoice_number}} er vedhæftet eller kan downloades via din konto.
            Beløb: {{total_amount}} DKK

            Kh,
            {{business_name}}
            """
        ),
        "available_variables": {
            "customer_name": "Kundens navn",
            "invoice_number": "Fakturanummer",
            "total_amount": "Beløb",
            "business_name": "Virksomhedsnavn",
        },
    },
}


class EmailTemplateRenderer:
    """Renders email templates with variables substitution."""

    def __init__(self):
        """Initialize Jinja2 environment for template rendering."""
        self.env = Environment(
            loader=BaseLoader(),
            autoescape=True,
            trim_blocks=True,
            lstrip_blocks=True,
        )

    def render_template(
        self,
        template_content: str,
        variables: Dict[str, Any]
    ) -> str:
        """
        Render template with variables.

        Args:
            template_content: Template string content
            variables: Variables to substitute in template

        Returns:
            Rendered template string
        """
        try:
            template = self.env.from_string(template_content)
            return template.render(**variables)
        except Exception as e:
            logger.error(
                "Template rendering failed",
                template_content=template_content[:100],
                variables=variables,
                error=str(e)
            )
            raise ValueError(f"Template rendering failed: {e}")

    @staticmethod
    def get_booking_variables(booking: Booking) -> Dict[str, Any]:
        """
        Extract template variables from booking.

        Args:
            booking: Booking instance

        Returns:
            Dictionary of template variables
        """
        return {
            "booking_number": booking.booking_number,
            "customer_name": booking.customer.first_name + " " + booking.customer.last_name,
            "customer_first_name": booking.customer.first_name,
            "loctician_name": booking.loctician.first_name + " " + booking.loctician.last_name,
            "service_name": booking.service.name,
            "service_description": booking.service.description,
            "appointment_date": booking.appointment_start.strftime("%d/%m/%Y"),
            "appointment_time": booking.appointment_start.strftime("%H:%M"),
            "appointment_datetime": booking.appointment_start.strftime("%d/%m/%Y kl. %H:%M"),
            "duration": booking.duration_minutes,
            "total_amount": str(booking.total_amount),
            "status": booking.status.value,
            "customer_notes": booking.customer_notes or "",
            "special_requests": booking.special_requests or "",
            "business_name": "Loctician Booking",
            "support_email": settings.SMTP_FROM or "support@example.com",
            "booking_url": f"https://app.example.com/bookings/{booking.id}",
            "cancel_url": f"https://app.example.com/bookings/{booking.id}/cancel",
        }


class EmailSender:
    """Handles email sending via SMTP."""

    def __init__(self):
        """Initialize SMTP configuration."""
        self.smtp_host = settings.SMTP_HOST
        self.smtp_port = settings.SMTP_PORT
        self.smtp_user = settings.SMTP_USER
        self.smtp_password = settings.SMTP_PASSWORD
        self.from_email = settings.SMTP_FROM
        self.from_name = settings.SMTP_FROM_NAME
        self.smtp_starttls = getattr(settings, "SMTP_STARTTLS", True)
        self.smtp_ssl = getattr(settings, "SMTP_SSL", False)
        self.brevo_api_key = getattr(settings, "BREVO_API_KEY", None)
        self.brevo_api_base_url = getattr(
            settings, "BREVO_API_BASE_URL", "https://api.brevo.com/v3"
        )
        self._brevo_api_client = None
        self._brevo_transactional_api = None
        self.debug_output_dir = Path(
            getattr(settings, "EMAIL_DEBUG_OUTPUT_DIR", "./tmp/emails")
        )

    def _get_brevo_client(self):
        """Initialise (or return cached) Brevo transactional email client."""
        if not self.brevo_api_key or sib_api_v3_sdk is None:
            return None

        if self._brevo_transactional_api is None:
            configuration = sib_api_v3_sdk.Configuration()
            configuration.api_key["api-key"] = self.brevo_api_key
            if self.brevo_api_base_url:
                configuration.host = self.brevo_api_base_url

            self._brevo_api_client = sib_api_v3_sdk.ApiClient(configuration)
            self._brevo_transactional_api = sib_api_v3_sdk.TransactionalEmailsApi(
                self._brevo_api_client
            )

        return self._brevo_transactional_api

    async def _send_via_brevo(
        self,
        to_email: str,
        to_name: str,
        subject: str,
        html_content: Optional[str],
        text_content: Optional[str],
        from_email: Optional[str],
        from_name: Optional[str],
    ) -> Tuple[bool, Optional[str]]:
        """Send email using Brevo Transactional Emails API."""

        api_instance = self._get_brevo_client()
        if api_instance is None:
            logger.error("Brevo SDK not available or API key missing")
            return False, "Brevo configuration not set"

        sender_email = from_email or self.from_email
        sender_name = from_name or self.from_name

        if not sender_email:
            logger.error("Brevo sender email missing")
            return False, "Sender email not configured"

        def _send_email_via_brevo():
            send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
                sender={"name": sender_name, "email": sender_email},
                to=[{"email": to_email, "name": to_name}],
                subject=subject,
                html_content=html_content,
                text_content=text_content,
            )
            return api_instance.send_transac_email(send_smtp_email)

        try:
            await asyncio.to_thread(_send_email_via_brevo)
            logger.info(
                "Email sent successfully via Brevo",
                to_email=to_email,
                subject=subject,
            )
            return True, None
        except BrevoApiException as exc:  # pragma: no cover - network dependent
            error_msg = getattr(exc, "body", str(exc))
            logger.error(
                "Brevo API error",
                to_email=to_email,
                subject=subject,
                error=error_msg,
            )
            return False, error_msg
        except Exception as exc:  # pragma: no cover - safety net
            error_msg = str(exc)
            logger.error(
                "Unexpected Brevo error",
                to_email=to_email,
                subject=subject,
                error=error_msg,
            )
            return False, error_msg

    def _build_email_message(
        self,
        *,
        to_email: str,
        to_name: Optional[str],
        subject: str,
        html_content: Optional[str],
        text_content: Optional[str],
        from_email: str,
        from_name: Optional[str],
    ) -> MIMEMultipart:
        """Create a MIME message for sending or debug output."""

        message = MIMEMultipart("alternative")
        message["From"] = formataddr((from_name or self.from_name, from_email))
        message["To"] = formataddr((to_name or "", to_email))
        message["Subject"] = subject

        if text_content:
            text_part = MIMEText(text_content, "plain", "utf-8")
            message.attach(text_part)

        if html_content:
            html_part = MIMEText(html_content, "html", "utf-8")
            message.attach(html_part)

        return message

    async def _write_email_to_disk(
        self,
        message: MIMEMultipart,
        *,
        to_email: str,
    ) -> Tuple[bool, Optional[str]]:
        """Persist email content to disk for local testing environments."""

        safe_email = re.sub(r"[^A-Za-z0-9_.-]", "_", to_email)
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
        output_path = self.debug_output_dir / f"{timestamp}_{safe_email}.eml"

        def _write() -> None:
            self.debug_output_dir.mkdir(parents=True, exist_ok=True)
            with output_path.open("w", encoding="utf-8") as file_handle:
                file_handle.write(message.as_string())

        try:
            await asyncio.to_thread(_write)
            logger.info(
                "Email written to debug output",
                to_email=to_email,
                path=str(output_path),
            )
            return True, str(output_path)
        except Exception as exc:  # pragma: no cover - filesystem issues are environment specific
            error_msg = str(exc)
            logger.error(
                "Failed to write email to disk",
                to_email=to_email,
                error=error_msg,
            )
            return False, error_msg

    async def send_email(
        self,
        to_email: str,
        to_name: str,
        subject: str,
        html_content: Optional[str] = None,
        text_content: Optional[str] = None,
        from_email: Optional[str] = None,
        from_name: Optional[str] = None,
    ) -> Tuple[bool, Optional[str]]:
        """
        Send email via configured provider or fall back to local debug output.

        Args:
            to_email: Recipient email address
            to_name: Recipient name
            subject: Email subject
            html_content: HTML email content
            text_content: Plain text email content
            from_email: Sender email (optional)
            from_name: Sender name (optional)

        Returns:
            Tuple of (success, provider_message_id_or_error)
        """
        if not html_content and not text_content:
            return False, "No email content provided"

        sender_email = from_email or self.from_email
        sender_name = from_name or self.from_name

        if not sender_email:
            logger.error("Sender email not configured")
            return False, "Sender email not configured"

        if self.brevo_api_key:
            success, provider_id_or_error = await self._send_via_brevo(
                to_email,
                to_name,
                subject,
                html_content,
                text_content,
                sender_email,
                sender_name,
            )
            return success, provider_id_or_error

        message = self._build_email_message(
            to_email=to_email,
            to_name=to_name,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            from_email=sender_email,
            from_name=sender_name,
        )

        if self.smtp_host and self.smtp_user and self.smtp_password:
            try:
                await aiosmtplib.send(
                    message,
                    hostname=self.smtp_host,
                    port=self.smtp_port,
                    username=self.smtp_user,
                    password=self.smtp_password,
                    start_tls=self.smtp_starttls,
                    use_tls=self.smtp_ssl,
                )

                logger.info(
                    "Email sent successfully",
                    to_email=to_email,
                    subject=subject,
                )
                return True, None
            except Exception as exc:  # pragma: no cover - depends on environment
                error_msg = str(exc)
                logger.error(
                    "Email sending failed",
                    to_email=to_email,
                    subject=subject,
                    error=error_msg,
                )
                return False, error_msg

        # Development fallback: write email contents to disk for inspection.
        return await self._write_email_to_disk(message, to_email=to_email)


class EmailService:
    """Main email service handling all email operations."""

    def __init__(self):
        """Initialize email service components."""
        self.renderer = EmailTemplateRenderer()
        self.sender = EmailSender()
        self.default_templates = DEFAULT_TEMPLATES
        self.business_name = settings.SMTP_FROM_NAME or "Loctician Booking"

    async def get_template(
        self,
        template_type: TemplateType,
        session: AsyncSession
    ) -> Optional[EmailTemplate]:
        """
        Get active email template by type.

        Args:
            template_type: Type of template to retrieve
            session: Database session

        Returns:
            EmailTemplate instance or None
        """
        result = await session.execute(
            select(EmailTemplate)
            .where(
                and_(
                    EmailTemplate.template_type == template_type,
                    EmailTemplate.is_active == True
                )
            )
            .order_by(EmailTemplate.version.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def create_template(
        self,
        name: str,
        template_type: TemplateType,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        available_variables: Optional[Dict[str, Any]] = None,
        created_by: Optional[str] = None,
        session: AsyncSession = None
    ) -> EmailTemplate:
        """
        Create new email template.

        Args:
            name: Template name
            template_type: Type of template
            subject: Email subject template
            html_content: HTML content template
            text_content: Plain text content template
            available_variables: Documentation of available variables
            created_by: User ID who created the template
            session: Database session

        Returns:
            Created EmailTemplate instance
        """
        if session is None:
            async with get_db_session() as session:
                return await self.create_template(
                    name, template_type, subject, html_content,
                    text_content, available_variables, created_by, session
                )

        result = await session.execute(
            select(func.max(EmailTemplate.version)).where(
                EmailTemplate.template_type == template_type
            )
        )
        current_version = result.scalar() or 0

        # Deactivate existing templates of same type
        await session.execute(
            update(EmailTemplate)
            .where(EmailTemplate.template_type == template_type)
            .values(is_active=False)
        )

        # Create new template
        template = EmailTemplate(
            name=name,
            template_type=template_type,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            available_variables=available_variables,
            created_by=created_by,
            is_active=True,
            version=current_version + 1
        )

        session.add(template)
        await session.commit()
        await session.refresh(template)

        logger.info(
            "Email template created",
            template_id=template.id,
            template_type=template_type,
            name=name
        )

        return template

    async def ensure_default_templates(
        self,
        session: AsyncSession = None
    ) -> None:
        """Ensure that critical email templates exist with expected content."""

        if session is None:
            async with get_db_session() as session:
                await self.ensure_default_templates(session=session)
                return

        for template_type, template_data in self.default_templates.items():
            existing = await self.get_template(template_type, session)

            if existing:
                current_subject = (existing.subject or "").strip()
                current_html = (existing.html_content or "").strip()
                current_text = (existing.text_content or "").strip()

                if (
                    current_subject == template_data["subject"].strip()
                    and current_html == template_data["html_content"].strip()
                    and current_text == (template_data.get("text_content") or "").strip()
                ):
                    continue

                logger.info(
                    "Updating email template to default",
                    template_type=template_type,
                    previous_version=existing.version,
                )

            await self.create_template(
                name=template_data["name"],
                template_type=template_type,
                subject=template_data["subject"],
                html_content=template_data["html_content"],
                text_content=template_data.get("text_content"),
                available_variables=template_data.get("available_variables"),
                session=session,
            )

    async def queue_email(
        self,
        to_email: str,
        subject: str,
        template_type: Optional[TemplateType] = None,
        template_variables: Optional[Dict[str, Any]] = None,
        html_content: Optional[str] = None,
        text_content: Optional[str] = None,
        to_name: Optional[str] = None,
        from_email: Optional[str] = None,
        from_name: Optional[str] = None,
        user_id: Optional[str] = None,
        booking_id: Optional[str] = None,
        scheduled_at: Optional[datetime] = None,
        session: AsyncSession = None
    ) -> EmailQueue:
        """
        Queue email for sending.

        Args:
            to_email: Recipient email
            subject: Email subject
            template_type: Template type to use
            template_variables: Variables for template
            html_content: Direct HTML content (if not using template)
            text_content: Direct text content (if not using template)
            to_name: Recipient name
            from_email: Sender email
            from_name: Sender name
            user_id: Associated user ID
            booking_id: Associated booking ID
            scheduled_at: When to send the email
            session: Database session

        Returns:
            Created EmailQueue instance
        """
        if session is None:
            async with get_db_session() as session:
                return await self.queue_email(
                    to_email, subject, template_type, template_variables,
                    html_content, text_content, to_name, from_email, from_name,
                    user_id, booking_id, scheduled_at, session
                )

        template_id = None
        final_html_content = html_content
        final_text_content = text_content

        # If using template, render content
        if template_type:
            template = await self.get_template(template_type, session)
            if template:
                template_id = template.id
                variables = template_variables or {}

                # Render subject and content
                subject = self.renderer.render_template(template.subject, variables)
                final_html_content = self.renderer.render_template(
                    template.html_content, variables
                )
                if template.text_content:
                    final_text_content = self.renderer.render_template(
                        template.text_content, variables
                    )

        # Create queue entry
        sender_email = from_email or settings.SMTP_FROM
        sender_name = from_name or settings.SMTP_FROM_NAME

        if not sender_email:
            raise ValueError("Sender email must be configured before queuing emails")

        queue_entry = EmailQueue(
            template_id=template_id,
            to_email=to_email,
            to_name=to_name,
            from_email=sender_email,
            from_name=sender_name,
            subject=subject,
            html_content=final_html_content,
            text_content=final_text_content,
            template_variables=template_variables,
            user_id=user_id,
            booking_id=booking_id,
            scheduled_at=scheduled_at or datetime.utcnow(),
            created_at=datetime.utcnow()
        )

        session.add(queue_entry)
        await session.commit()
        await session.refresh(queue_entry)

        logger.info(
            "Email queued",
            queue_id=queue_entry.id,
            to_email=to_email,
            template_type=template_type,
            scheduled_at=queue_entry.scheduled_at
        )

        return queue_entry

    async def send_marketing_email(
        self,
        *,
        recipient_email: str,
        recipient_name: Optional[str] = None,
        custom_message: Optional[str] = None,
        special_offer: Optional[str] = None,
        cta_label: str = "Book en tid",
        cta_url: Optional[str] = None,
        session: AsyncSession = None,
    ) -> bool:
        """Queue a marketing email using the default marketing template."""

        if session is None:
            async with get_db_session() as session:
                return await self.send_marketing_email(
                    recipient_email=recipient_email,
                    recipient_name=recipient_name,
                    custom_message=custom_message,
                    special_offer=special_offer,
                    cta_label=cta_label,
                    cta_url=cta_url,
                    session=session,
                )

        variables = {
            "custom_message": custom_message
            or "Vi glæder os til at inspirere dig med nye styles og hårplejeråd.",
            "special_offer": special_offer or "",
            "cta_label": cta_label,
            "cta_url": cta_url or f"{settings.FRONTEND_URL.rstrip('/')}/book", 
            "business_name": self.business_name,
        }

        fallback_name = recipient_name
        if not fallback_name:
            fallback_name = recipient_email.split("@")[0] if "@" in recipient_email else recipient_email

        queue_entry = await self.queue_email(
            to_email=recipient_email,
            to_name=fallback_name,
            subject="EKSKLUSIVE OPDATERINGER – Nyheder fra dit loctician team",
            template_type=TemplateType.MARKETING,
            template_variables=variables,
            session=session,
        )

        logger.info(
            "Marketing email queued",
            to_email=recipient_email,
            queue_id=getattr(queue_entry, "id", None),
        )

        return queue_entry is not None

    async def send_contact_message(
        self,
        *,
        sender_name: str,
        sender_email: str,
        message_body: str,
        sender_phone: Optional[str] = None,
        topic: Optional[str] = None,
        recipient_email: Optional[str] = None,
        session: AsyncSession = None,
    ) -> bool:
        """Queue a contact message so staff receives website enquiries."""

        if session is None:
            async with get_db_session() as session:
                return await self.send_contact_message(
                    sender_name=sender_name,
                    sender_email=sender_email,
                    message_body=message_body,
                    sender_phone=sender_phone,
                    topic=topic,
                    recipient_email=recipient_email,
                    session=session,
                )

        target_email = recipient_email or settings.SMTP_FROM
        if not target_email:
            raise ValueError("A recipient email must be provided for contact messages")

        variables = {
            "sender_name": sender_name,
            "sender_email": sender_email,
            "sender_phone": sender_phone or "Ikke oplyst",
            "topic": topic or "Kontaktformular",
            "message_body": message_body,
        }

        queue_entry = await self.queue_email(
            to_email=target_email,
            subject=f"Ny kontaktforespørgsel fra {sender_name}",
            template_type=TemplateType.CONTACT,
            template_variables=variables,
            from_name=self.business_name,
            session=session,
        )

        logger.info(
            "Contact email queued",
            to_email=target_email,
            sender_email=sender_email,
            queue_id=getattr(queue_entry, "id", None),
        )

        return queue_entry is not None

    async def send_internal_notification(
        self,
        *,
        recipients: List[Tuple[str, Optional[str]]],
        subject: str,
        message_body: str,
        audience: Literal["admin", "staff"] = "admin",
        metadata: Optional[Dict[str, Any]] = None,
        session: AsyncSession = None,
    ) -> int:
        """Queue notifications for admin or staff members."""

        if not recipients:
            return 0

        if session is None:
            async with get_db_session() as session:
                return await self.send_internal_notification(
                    recipients=recipients,
                    subject=subject,
                    message_body=message_body,
                    audience=audience,
                    metadata=metadata,
                    session=session,
                )

        template_type = (
            TemplateType.ADMIN_NOTIFICATION
            if audience == "admin"
            else TemplateType.STAFF_NOTIFICATION
        )
        metadata_payload = (
            json.dumps(metadata, ensure_ascii=False, indent=2) if metadata else ""
        )
        timestamp = datetime.utcnow().strftime("%d-%m-%Y %H:%M")

        delivered = 0
        for email, name in recipients:
            variables = {
                "subject": subject,
                "message_body": message_body,
                "timestamp": timestamp,
                "metadata": metadata_payload,
            }

            try:
                queue_entry = await self.queue_email(
                    to_email=email,
                    to_name=name,
                    subject=f"{subject}",
                    template_type=template_type,
                    template_variables=variables,
                    session=session,
                )
                if queue_entry:
                    delivered += 1
            except Exception as exc:  # pragma: no cover - defensive log
                logger.error(
                    "Failed to queue internal notification",
                    to_email=email,
                    audience=audience,
                    error=str(exc),
                )

        logger.info(
            "Internal notifications queued",
            audience=audience,
            total=len(recipients),
            delivered=delivered,
        )

        return delivered

    async def process_email_queue(
        self,
        batch_size: int = 50,
        session: AsyncSession = None
    ) -> int:
        """
        Process pending emails in queue.

        Args:
            batch_size: Number of emails to process in batch
            session: Database session

        Returns:
            Number of emails processed
        """
        if session is None:
            async with get_db_session() as session:
                return await self.process_email_queue(batch_size, session)

        # Get pending emails
        result = await session.execute(
            select(EmailQueue)
            .where(
                and_(
                    EmailQueue.status == EmailStatus.QUEUED,
                    EmailQueue.scheduled_at <= datetime.utcnow()
                )
            )
            .limit(batch_size)
            .order_by(EmailQueue.scheduled_at)
        )

        pending_emails = result.scalars().all()
        processed_count = 0

        for email in pending_emails:
            try:
                # Mark as sending
                email.status = EmailStatus.SENDING
                await session.commit()

                # Send email
                success, provider_or_error = await self.sender.send_email(
                    to_email=email.to_email,
                    to_name=email.to_name,
                    subject=email.subject,
                    html_content=email.html_content,
                    text_content=email.text_content,
                    from_email=email.from_email,
                    from_name=email.from_name
                )

                if success:
                    email.mark_sent(provider_message_id=provider_or_error)
                    processed_count += 1
                else:
                    email.mark_failed(provider_or_error or "Unknown error")

                await session.commit()

            except Exception as e:
                logger.error(
                    "Email processing failed",
                    email_id=email.id,
                    error=str(e)
                )
                email.mark_failed(str(e))
                await session.commit()

        logger.info(
            "Email queue processed",
            processed_count=processed_count,
            total_pending=len(pending_emails)
        )

        return processed_count

    async def send_booking_confirmation(
        self,
        booking_id: str,
        session: AsyncSession = None
    ) -> bool:
        """
        Send booking confirmation email.

        Args:
            booking_id: Booking ID
            session: Database session

        Returns:
            True if email was queued successfully
        """
        if session is None:
            async with get_db_session() as session:
                return await self.send_booking_confirmation(booking_id, session)

        # Get booking with relationships
        result = await session.execute(
            select(Booking)
            .options(
                selectinload(Booking.customer),
                selectinload(Booking.loctician),
                selectinload(Booking.service)
            )
            .where(Booking.id == booking_id)
        )

        booking = result.scalar_one_or_none()
        if not booking:
            logger.error("Booking not found for confirmation", booking_id=booking_id)
            return False

        # Get template variables
        variables = self.renderer.get_booking_variables(booking)

        # Queue confirmation email
        try:
            await self.queue_email(
                to_email=booking.customer.email,
                to_name=f"{booking.customer.first_name} {booking.customer.last_name}",
                subject=f"Booking bekræftelse - {booking.booking_number}",
                template_type=TemplateType.BOOKING_CONFIRMATION,
                template_variables=variables,
                user_id=booking.customer_id,
                booking_id=booking_id,
                session=session
            )

            # Update booking confirmation status
            booking.confirmation_sent_at = datetime.utcnow()
            await session.commit()

            return True

        except Exception as e:
            logger.error(
                "Failed to queue booking confirmation",
                booking_id=booking_id,
                error=str(e)
            )
            return False

    async def send_appointment_reminder(
        self,
        booking_id: str,
        hours_before: int = 24,
        session: AsyncSession = None
    ) -> bool:
        """
        Send appointment reminder email.

        Args:
            booking_id: Booking ID
            hours_before: Hours before appointment
            session: Database session

        Returns:
            True if email was queued successfully
        """
        if session is None:
            async with get_db_session() as session:
                return await self.send_appointment_reminder(
                    booking_id, hours_before, session
                )

        # Get booking with relationships
        result = await session.execute(
            select(Booking)
            .options(
                selectinload(Booking.customer),
                selectinload(Booking.loctician),
                selectinload(Booking.service)
            )
            .where(Booking.id == booking_id)
        )

        booking = result.scalar_one_or_none()
        if not booking or booking.status != BookingStatus.CONFIRMED:
            return False

        # Get template variables
        variables = self.renderer.get_booking_variables(booking)
        variables["hours_before"] = hours_before

        # Queue reminder email
        try:
            await self.queue_email(
                to_email=booking.customer.email,
                to_name=f"{booking.customer.first_name} {booking.customer.last_name}",
                subject="Påmindelse: Din aftale i morgen",
                template_type=TemplateType.REMINDER,
                template_variables=variables,
                user_id=booking.customer_id,
                booking_id=booking_id,
                session=session
            )

            # Update reminder status
            booking.reminder_sent_at = datetime.utcnow()
            await session.commit()

            return True

        except Exception as e:
            logger.error(
                "Failed to queue appointment reminder",
                booking_id=booking_id,
                error=str(e)
            )
            return False

    async def send_cancellation_notification(
        self,
        booking_id: str,
        cancelled_by_customer: bool = True,
        session: AsyncSession = None
    ) -> bool:
        """
        Send booking cancellation notification.

        Args:
            booking_id: Booking ID
            cancelled_by_customer: Whether customer cancelled
            session: Database session

        Returns:
            True if email was queued successfully
        """
        if session is None:
            async with get_db_session() as session:
                return await self.send_cancellation_notification(
                    booking_id, cancelled_by_customer, session
                )

        # Get booking with relationships
        result = await session.execute(
            select(Booking)
            .options(
                selectinload(Booking.customer),
                selectinload(Booking.loctician),
                selectinload(Booking.service)
            )
            .where(Booking.id == booking_id)
        )

        booking = result.scalar_one_or_none()
        if not booking:
            return False

        # Get template variables
        variables = self.renderer.get_booking_variables(booking)
        variables["cancelled_by_customer"] = cancelled_by_customer
        variables["cancellation_reason"] = booking.cancellation_reason or ""

        # Send to both customer and loctician
        emails_to_send = []

        # Customer notification
        emails_to_send.append({
            "to_email": booking.customer.email,
            "to_name": f"{booking.customer.first_name} {booking.customer.last_name}",
            "user_id": booking.customer_id
        })

        # Loctician notification
        emails_to_send.append({
            "to_email": booking.loctician.email,
            "to_name": f"{booking.loctician.first_name} {booking.loctician.last_name}",
            "user_id": booking.loctician_id
        })

        try:
            for email_data in emails_to_send:
                await self.queue_email(
                    to_email=email_data["to_email"],
                    to_name=email_data["to_name"],
                    subject=f"Aflysning af booking - {booking.booking_number}",
                    template_type=TemplateType.CANCELLATION,
                    template_variables=variables,
                    user_id=email_data["user_id"],
                    booking_id=booking_id,
                    session=session
                )

            return True

        except Exception as e:
            logger.error(
                "Failed to queue cancellation notifications",
                booking_id=booking_id,
                error=str(e)
            )
            return False

    async def schedule_automatic_reminders(self, session: AsyncSession = None) -> int:
        """
        Schedule automatic reminder emails for upcoming bookings.

        Args:
            session: Database session

        Returns:
            Number of reminders scheduled
        """
        if session is None:
            async with get_db_session() as session:
                return await self.schedule_automatic_reminders(session)

        # Get confirmed bookings happening in 24 hours that haven't had reminders sent
        reminder_time = datetime.utcnow() + timedelta(hours=24)
        window_start = reminder_time - timedelta(minutes=30)
        window_end = reminder_time + timedelta(minutes=30)

        result = await session.execute(
            select(Booking)
            .where(
                and_(
                    Booking.status == BookingStatus.CONFIRMED,
                    Booking.appointment_start.between(window_start, window_end),
                    Booking.reminder_sent_at.is_(None)
                )
            )
        )

        bookings = result.scalars().all()
        scheduled_count = 0

        for booking in bookings:
            success = await self.send_appointment_reminder(
                booking.id, hours_before=24, session=session
            )
            if success:
                scheduled_count += 1

        logger.info(
            "Automatic reminders scheduled",
            scheduled_count=scheduled_count,
            total_eligible=len(bookings)
        )

        return scheduled_count


# Create service instance
email_service = EmailService()