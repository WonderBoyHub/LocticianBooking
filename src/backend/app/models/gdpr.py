"""
GDPR compliance models for data protection and consent management.
"""
from datetime import datetime
from typing import Dict, List, Optional

from sqlalchemy import DateTime, ForeignKey, JSON, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, IS_POSTGRES
from app.models.mixins import BaseModel, UUIDMixin


class EmailConsent(Base, UUIDMixin):
    """Track email consent and preferences for GDPR compliance."""

    __tablename__ = "email_consents"

    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id"),
        nullable=False,
        unique=True
    )

    # Consent flags for different email types
    marketing_consent: Mapped[bool] = mapped_column(default=False, nullable=False)
    booking_notifications: Mapped[bool] = mapped_column(default=True, nullable=False)
    appointment_reminders: Mapped[bool] = mapped_column(default=True, nullable=False)
    service_updates: Mapped[bool] = mapped_column(default=False, nullable=False)

    # Consent metadata
    consent_given_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    consent_method: Mapped[str] = mapped_column(
        String(50), nullable=False  # 'registration', 'explicit', 'opt_in'
    )
    consent_ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    consent_user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Withdrawal tracking
    withdrawn_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    withdrawal_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="email_consent")

    @property
    def has_marketing_consent(self) -> bool:
        """Check if user has valid marketing consent."""
        return self.marketing_consent and not self.withdrawn_at

    @property
    def can_receive_marketing(self) -> bool:
        """Check if user can receive marketing emails."""
        return self.has_marketing_consent

    @property
    def can_receive_booking_notifications(self) -> bool:
        """Check if user can receive booking notifications."""
        return self.booking_notifications and not self.withdrawn_at

    def withdraw_consent(self, reason: Optional[str] = None) -> None:
        """Withdraw all email consent."""
        self.marketing_consent = False
        self.booking_notifications = False
        self.appointment_reminders = False
        self.service_updates = False
        self.withdrawn_at = datetime.utcnow()
        self.withdrawal_reason = reason

    def __repr__(self) -> str:
        return f"<EmailConsent(user_id={self.user_id}, marketing={self.marketing_consent})>"


class EmailUnsubscribe(Base, UUIDMixin):
    """Track email unsubscribe requests and tokens."""

    __tablename__ = "email_unsubscribes"

    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id"),
        nullable=True
    )

    # Unsubscribe token for secure unsubscribe links
    unsubscribe_token: Mapped[str] = mapped_column(
        String(128), nullable=False, unique=True, index=True
    )

    # What they unsubscribed from
    email_type: Mapped[str] = mapped_column(String(50), nullable=False)  # 'all', 'marketing', etc.
    unsubscribed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    # Source of unsubscribe
    source: Mapped[str] = mapped_column(
        String(50), nullable=False  # 'email_link', 'profile_settings', 'admin'
    )
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    user: Mapped[Optional["User"]] = relationship("User")

    @classmethod
    def generate_token(cls) -> str:
        """Generate secure unsubscribe token."""
        import secrets
        return secrets.token_urlsafe(96)

    def __repr__(self) -> str:
        return f"<EmailUnsubscribe(email={self.email}, type={self.email_type})>"


class DataRetentionPolicy(Base, BaseModel):
    """Data retention policies for GDPR compliance."""

    __tablename__ = "data_retention_policies"

    policy_name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)

    # Data types covered
    _JSONType = JSONB if IS_POSTGRES else JSON

    data_types: Mapped[List[str]] = mapped_column(_JSONType, nullable=False)

    # Retention periods (in days)
    retention_period_days: Mapped[int] = mapped_column(nullable=False)

    # Deletion rules
    deletion_criteria: Mapped[Dict[str, str]] = mapped_column(_JSONType, nullable=False)
    auto_delete_enabled: Mapped[bool] = mapped_column(default=True, nullable=False)

    # Legal basis
    legal_basis: Mapped[str] = mapped_column(String(100), nullable=False)
    legal_basis_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    def __repr__(self) -> str:
        return f"<DataRetentionPolicy(name={self.policy_name}, retention={self.retention_period_days} days)>"


class DataDeletionLog(Base, UUIDMixin):
    """Log of data deletion activities for audit purposes."""

    __tablename__ = "data_deletion_logs"

    user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id"),
        nullable=True
    )

    # What was deleted
    data_type: Mapped[str] = mapped_column(String(100), nullable=False)
    table_name: Mapped[str] = mapped_column(String(100), nullable=False)
    record_ids: Mapped[List[str]] = mapped_column(_JSONType, nullable=False)
    record_count: Mapped[int] = mapped_column(nullable=False)

    # Deletion context
    deletion_reason: Mapped[str] = mapped_column(
        String(100), nullable=False  # 'retention_policy', 'user_request', 'legal_requirement'
    )
    policy_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("data_retention_policies.id"),
        nullable=True
    )

    # Execution details
    deleted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    deleted_by: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id"),
        nullable=True
    )

    # Verification
    verified_deleted: Mapped[bool] = mapped_column(default=False, nullable=False)
    verification_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    user: Mapped[Optional["User"]] = relationship("User", foreign_keys=[user_id])
    deleted_by_user: Mapped[Optional["User"]] = relationship("User", foreign_keys=[deleted_by])
    policy: Mapped[Optional["DataRetentionPolicy"]] = relationship("DataRetentionPolicy")

    def __repr__(self) -> str:
        return f"<DataDeletionLog(data_type={self.data_type}, count={self.record_count})>"


class ConsentAuditLog(Base, UUIDMixin):
    """Audit log for consent changes to ensure GDPR compliance."""

    __tablename__ = "consent_audit_logs"

    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id"),
        nullable=False
    )

    # What changed
    consent_type: Mapped[str] = mapped_column(String(50), nullable=False)
    previous_value: Mapped[Optional[bool]] = mapped_column(nullable=True)
    new_value: Mapped[bool] = mapped_column(nullable=False)

    # Change context
    change_reason: Mapped[str] = mapped_column(String(100), nullable=False)
    change_method: Mapped[str] = mapped_column(
        String(50), nullable=False  # 'profile_update', 'registration', 'unsubscribe', 'admin'
    )

    # Metadata
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Who made the change
    changed_by: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id"),
        nullable=True
    )

    # Additional context
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
    changed_by_user: Mapped[Optional["User"]] = relationship("User", foreign_keys=[changed_by])

    def __repr__(self) -> str:
        return f"<ConsentAuditLog(user_id={self.user_id}, type={self.consent_type}, changed_at={self.changed_at})>"