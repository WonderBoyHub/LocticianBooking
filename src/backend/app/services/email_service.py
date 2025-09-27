"""
Comprehensive email service for the Loctician Booking System.
Handles email templating, sending, queuing, and automation workflows.
"""
import asyncio
import smtplib
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict, List, Optional, Tuple

import aiosmtplib
import structlog
from jinja2 import BaseLoader, Environment, Template
from sqlalchemy import and_, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db_session
from app.models.booking import Booking
from app.models.email_template import EmailQueue, EmailTemplate
from app.models.enums import BookingStatus, EmailStatus, TemplateType
from app.models.user import User

logger = structlog.get_logger(__name__)


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
        Send email via SMTP.

        Args:
            to_email: Recipient email address
            to_name: Recipient name
            subject: Email subject
            html_content: HTML email content
            text_content: Plain text email content
            from_email: Sender email (optional)
            from_name: Sender name (optional)

        Returns:
            Tuple of (success, error_message)
        """
        if not self.smtp_host or not self.smtp_user or not self.smtp_password:
            logger.error("SMTP configuration missing")
            return False, "SMTP configuration not set"

        if not html_content and not text_content:
            return False, "No email content provided"

        try:
            # Create message
            message = MIMEMultipart("alternative")
            message["From"] = f"{from_name or self.from_name} <{from_email or self.from_email}>"
            message["To"] = f"{to_name} <{to_email}>"
            message["Subject"] = subject

            # Add text content
            if text_content:
                text_part = MIMEText(text_content, "plain", "utf-8")
                message.attach(text_part)

            # Add HTML content
            if html_content:
                html_part = MIMEText(html_content, "html", "utf-8")
                message.attach(html_part)

            # Send email via async SMTP
            await aiosmtplib.send(
                message,
                hostname=self.smtp_host,
                port=self.smtp_port,
                username=self.smtp_user,
                password=self.smtp_password,
                use_tls=True,
            )

            logger.info(
                "Email sent successfully",
                to_email=to_email,
                subject=subject
            )
            return True, None

        except Exception as e:
            error_msg = str(e)
            logger.error(
                "Email sending failed",
                to_email=to_email,
                subject=subject,
                error=error_msg
            )
            return False, error_msg


class EmailService:
    """Main email service handling all email operations."""

    def __init__(self):
        """Initialize email service components."""
        self.renderer = EmailTemplateRenderer()
        self.sender = EmailSender()

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
            is_active=True
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
        queue_entry = EmailQueue(
            template_id=template_id,
            to_email=to_email,
            to_name=to_name,
            from_email=from_email or settings.SMTP_FROM,
            from_name=from_name or settings.SMTP_FROM_NAME,
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
                success, error_message = await self.sender.send_email(
                    to_email=email.to_email,
                    to_name=email.to_name,
                    subject=email.subject,
                    html_content=email.html_content,
                    text_content=email.text_content,
                    from_email=email.from_email,
                    from_name=email.from_name
                )

                if success:
                    email.mark_sent()
                    processed_count += 1
                else:
                    email.mark_failed(error_message or "Unknown error")

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
                subject="Booking bekræftelse - {booking_number}",
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
                    subject="Aflysning af booking - {booking_number}",
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