"""
Email template and queue models.
"""
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, IS_POSTGRES
from app.models.enums import EmailStatus, TemplateType
from app.models.mixins import BaseModel, UUIDMixin


JSON_TYPE = JSONB if IS_POSTGRES else JSON


class EmailTemplate(Base, BaseModel):
    """Email templates for various communications."""

    __tablename__ = "email_templates"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    template_type: Mapped[TemplateType] = mapped_column(nullable=False)
    subject: Mapped[str] = mapped_column(String(200), nullable=False)
    html_content: Mapped[str] = mapped_column(Text, nullable=False)
    text_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Template variables documentation
    available_variables: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON_TYPE, nullable=True)

    # Versioning
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    created_by: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id"),
        nullable=True,
    )

    # Relationships
    creator: Mapped[Optional["User"]] = relationship("User")

    def __repr__(self) -> str:
        return f"<EmailTemplate(id={self.id}, name={self.name}, type={self.template_type})>"


class EmailQueue(Base, UUIDMixin):
    """Email queue for managing email delivery."""

    __tablename__ = "email_queue"

    template_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("email_templates.id"),
        nullable=True,
    )

    # Recipients
    to_email: Mapped[str] = mapped_column(String(255), nullable=False)
    to_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    from_email: Mapped[str] = mapped_column(String(255), nullable=False)
    from_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    # Content
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    html_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    text_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Context
    template_variables: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON_TYPE, nullable=True)
    user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id"),
        nullable=True,
    )
    booking_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("bookings.id"),
        nullable=True,
    )

    # Status tracking
    status: Mapped[EmailStatus] = mapped_column(default=EmailStatus.QUEUED, nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=3, nullable=False)

    # Scheduling
    scheduled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    sent_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    failed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # External provider info
    provider_message_id: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    # Relationships
    template: Mapped[Optional["EmailTemplate"]] = relationship("EmailTemplate")
    user: Mapped[Optional["User"]] = relationship("User")
    booking: Mapped[Optional["Booking"]] = relationship("Booking")

    @property
    def can_retry(self) -> bool:
        """Check if email can be retried."""
        return (
            self.status == EmailStatus.FAILED
            and self.attempts < self.max_attempts
        )

    def mark_sent(self, provider_message_id: Optional[str] = None) -> None:
        """Mark email as sent."""
        self.status = EmailStatus.SENT
        self.sent_at = datetime.utcnow()
        if provider_message_id:
            self.provider_message_id = provider_message_id

    def mark_failed(self, error_message: str) -> None:
        """Mark email as failed."""
        self.status = EmailStatus.FAILED
        self.failed_at = datetime.utcnow()
        self.error_message = error_message
        self.attempts += 1

    def __repr__(self) -> str:
        return f"<EmailQueue(id={self.id}, to={self.to_email}, status={self.status})>"