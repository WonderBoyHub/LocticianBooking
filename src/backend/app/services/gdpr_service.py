"""
GDPR compliance service for data protection and consent management.
Handles consent tracking, unsubscribe management, and data retention.
"""
import secrets
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

import structlog
from sqlalchemy import and_, delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db_session
from app.models.booking import Booking
from app.models.email_template import EmailQueue
from app.models.gdpr import (
    ConsentAuditLog,
    DataDeletionLog,
    DataRetentionPolicy,
    EmailConsent,
    EmailUnsubscribe,
)
from app.models.user import User

logger = structlog.get_logger(__name__)


class GDPRService:
    """Main GDPR compliance service."""

    def __init__(self):
        """Initialize GDPR service."""
        pass

    # Consent Management
    async def create_consent_record(
        self,
        user_id: str,
        marketing_consent: bool = False,
        booking_notifications: bool = True,
        appointment_reminders: bool = True,
        service_updates: bool = False,
        consent_method: str = "registration",
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        session: AsyncSession = None
    ) -> EmailConsent:
        """
        Create initial consent record for a user.

        Args:
            user_id: User ID
            marketing_consent: Consent for marketing emails
            booking_notifications: Consent for booking notifications
            appointment_reminders: Consent for appointment reminders
            service_updates: Consent for service updates
            consent_method: How consent was obtained
            ip_address: User's IP address
            user_agent: User's browser user agent
            session: Database session

        Returns:
            Created EmailConsent instance
        """
        if session is None:
            async with get_db_session() as session:
                return await self.create_consent_record(
                    user_id, marketing_consent, booking_notifications,
                    appointment_reminders, service_updates, consent_method,
                    ip_address, user_agent, session
                )

        # Check if consent record already exists
        result = await session.execute(
            select(EmailConsent).where(EmailConsent.user_id == user_id)
        )
        existing_consent = result.scalar_one_or_none()

        if existing_consent:
            logger.warning(
                "Consent record already exists",
                user_id=user_id
            )
            return existing_consent

        # Create new consent record
        consent = EmailConsent(
            user_id=user_id,
            marketing_consent=marketing_consent,
            booking_notifications=booking_notifications,
            appointment_reminders=appointment_reminders,
            service_updates=service_updates,
            consent_given_at=datetime.utcnow(),
            consent_method=consent_method,
            consent_ip_address=ip_address,
            consent_user_agent=user_agent,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        session.add(consent)
        await session.commit()
        await session.refresh(consent)

        # Create audit log entries
        await self._log_consent_changes(
            user_id=user_id,
            changes={
                "marketing_consent": (None, marketing_consent),
                "booking_notifications": (None, booking_notifications),
                "appointment_reminders": (None, appointment_reminders),
                "service_updates": (None, service_updates)
            },
            change_method=consent_method,
            ip_address=ip_address,
            user_agent=user_agent,
            session=session
        )

        logger.info(
            "Consent record created",
            user_id=user_id,
            consent_method=consent_method
        )

        return consent

    async def update_consent(
        self,
        user_id: str,
        marketing_consent: Optional[bool] = None,
        booking_notifications: Optional[bool] = None,
        appointment_reminders: Optional[bool] = None,
        service_updates: Optional[bool] = None,
        change_method: str = "profile_update",
        changed_by: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        session: AsyncSession = None
    ) -> Optional[EmailConsent]:
        """
        Update user consent preferences.

        Args:
            user_id: User ID
            marketing_consent: New marketing consent status
            booking_notifications: New booking notifications status
            appointment_reminders: New appointment reminders status
            service_updates: New service updates status
            change_method: How the change was made
            changed_by: Who made the change (for admin changes)
            ip_address: User's IP address
            user_agent: User's browser user agent
            session: Database session

        Returns:
            Updated EmailConsent instance or None if not found
        """
        if session is None:
            async with get_db_session() as session:
                return await self.update_consent(
                    user_id, marketing_consent, booking_notifications,
                    appointment_reminders, service_updates, change_method,
                    changed_by, ip_address, user_agent, session
                )

        # Get existing consent record
        result = await session.execute(
            select(EmailConsent).where(EmailConsent.user_id == user_id)
        )
        consent = result.scalar_one_or_none()

        if not consent:
            logger.error("Consent record not found", user_id=user_id)
            return None

        # Track changes for audit log
        changes = {}
        if marketing_consent is not None and consent.marketing_consent != marketing_consent:
            changes["marketing_consent"] = (consent.marketing_consent, marketing_consent)
            consent.marketing_consent = marketing_consent

        if booking_notifications is not None and consent.booking_notifications != booking_notifications:
            changes["booking_notifications"] = (consent.booking_notifications, booking_notifications)
            consent.booking_notifications = booking_notifications

        if appointment_reminders is not None and consent.appointment_reminders != appointment_reminders:
            changes["appointment_reminders"] = (consent.appointment_reminders, appointment_reminders)
            consent.appointment_reminders = appointment_reminders

        if service_updates is not None and consent.service_updates != service_updates:
            changes["service_updates"] = (consent.service_updates, service_updates)
            consent.service_updates = service_updates

        if changes:
            consent.updated_at = datetime.utcnow()
            await session.commit()
            await session.refresh(consent)

            # Create audit log entries
            await self._log_consent_changes(
                user_id=user_id,
                changes=changes,
                change_method=change_method,
                changed_by=changed_by,
                ip_address=ip_address,
                user_agent=user_agent,
                session=session
            )

            logger.info(
                "Consent updated",
                user_id=user_id,
                changes=list(changes.keys()),
                change_method=change_method
            )

        return consent

    async def withdraw_all_consent(
        self,
        user_id: str,
        reason: Optional[str] = None,
        change_method: str = "user_request",
        changed_by: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        session: AsyncSession = None
    ) -> bool:
        """
        Withdraw all email consent for a user.

        Args:
            user_id: User ID
            reason: Reason for withdrawal
            change_method: How the withdrawal was made
            changed_by: Who made the change
            ip_address: User's IP address
            user_agent: User's browser user agent
            session: Database session

        Returns:
            True if successful
        """
        if session is None:
            async with get_db_session() as session:
                return await self.withdraw_all_consent(
                    user_id, reason, change_method, changed_by,
                    ip_address, user_agent, session
                )

        # Get existing consent record
        result = await session.execute(
            select(EmailConsent).where(EmailConsent.user_id == user_id)
        )
        consent = result.scalar_one_or_none()

        if not consent:
            logger.error("Consent record not found for withdrawal", user_id=user_id)
            return False

        # Track current values for audit
        changes = {}
        if consent.marketing_consent:
            changes["marketing_consent"] = (True, False)
        if consent.booking_notifications:
            changes["booking_notifications"] = (True, False)
        if consent.appointment_reminders:
            changes["appointment_reminders"] = (True, False)
        if consent.service_updates:
            changes["service_updates"] = (True, False)

        # Withdraw consent
        consent.withdraw_consent(reason)
        consent.updated_at = datetime.utcnow()

        await session.commit()

        # Create audit log entries
        if changes:
            await self._log_consent_changes(
                user_id=user_id,
                changes=changes,
                change_method=change_method,
                changed_by=changed_by,
                ip_address=ip_address,
                user_agent=user_agent,
                notes=f"Full consent withdrawal. Reason: {reason or 'Not specified'}",
                session=session
            )

        logger.info(
            "All consent withdrawn",
            user_id=user_id,
            reason=reason,
            change_method=change_method
        )

        return True

    async def get_consent_status(
        self,
        user_id: str,
        session: AsyncSession = None
    ) -> Optional[EmailConsent]:
        """
        Get current consent status for a user.

        Args:
            user_id: User ID
            session: Database session

        Returns:
            EmailConsent instance or None if not found
        """
        if session is None:
            async with get_db_session() as session:
                return await self.get_consent_status(user_id, session)

        result = await session.execute(
            select(EmailConsent).where(EmailConsent.user_id == user_id)
        )
        return result.scalar_one_or_none()

    # Unsubscribe Management
    async def create_unsubscribe_token(
        self,
        email: str,
        user_id: Optional[str] = None,
        email_type: str = "all",
        session: AsyncSession = None
    ) -> str:
        """
        Create secure unsubscribe token.

        Args:
            email: Email address
            user_id: Optional user ID
            email_type: Type of emails to unsubscribe from
            session: Database session

        Returns:
            Generated unsubscribe token
        """
        if session is None:
            async with get_db_session() as session:
                return await self.create_unsubscribe_token(
                    email, user_id, email_type, session
                )

        # Generate unique token
        token = EmailUnsubscribe.generate_token()

        # Check if unsubscribe record already exists for this email and type
        result = await session.execute(
            select(EmailUnsubscribe).where(
                and_(
                    EmailUnsubscribe.email == email,
                    EmailUnsubscribe.email_type == email_type
                )
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            return existing.unsubscribe_token

        # Create new unsubscribe record
        unsubscribe = EmailUnsubscribe(
            email=email,
            user_id=user_id,
            unsubscribe_token=token,
            email_type=email_type,
            unsubscribed_at=datetime.utcnow(),
            source="email_link"
        )

        session.add(unsubscribe)
        await session.commit()

        logger.info(
            "Unsubscribe token created",
            email=email,
            email_type=email_type,
            user_id=user_id
        )

        return token

    async def process_unsubscribe(
        self,
        token: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        session: AsyncSession = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Process unsubscribe request using token.

        Args:
            token: Unsubscribe token
            ip_address: User's IP address
            user_agent: User's browser user agent
            session: Database session

        Returns:
            Tuple of (success, error_message)
        """
        if session is None:
            async with get_db_session() as session:
                return await self.process_unsubscribe(
                    token, ip_address, user_agent, session
                )

        # Find unsubscribe record
        result = await session.execute(
            select(EmailUnsubscribe).where(EmailUnsubscribe.unsubscribe_token == token)
        )
        unsubscribe = result.scalar_one_or_none()

        if not unsubscribe:
            logger.warning("Invalid unsubscribe token", token=token[:16] + "...")
            return False, "Invalid or expired unsubscribe link"

        # Update unsubscribe record with metadata
        unsubscribe.ip_address = ip_address
        unsubscribe.user_agent = user_agent
        unsubscribe.unsubscribed_at = datetime.utcnow()

        # Update user consent if user is identified
        if unsubscribe.user_id:
            if unsubscribe.email_type == "all":
                await self.withdraw_all_consent(
                    user_id=unsubscribe.user_id,
                    reason="Unsubscribed via email link",
                    change_method="unsubscribe",
                    ip_address=ip_address,
                    user_agent=user_agent,
                    session=session
                )
            elif unsubscribe.email_type == "marketing":
                await self.update_consent(
                    user_id=unsubscribe.user_id,
                    marketing_consent=False,
                    change_method="unsubscribe",
                    ip_address=ip_address,
                    user_agent=user_agent,
                    session=session
                )

        await session.commit()

        logger.info(
            "Unsubscribe processed",
            email=unsubscribe.email,
            email_type=unsubscribe.email_type,
            user_id=unsubscribe.user_id
        )

        return True, None

    async def is_unsubscribed(
        self,
        email: str,
        email_type: str = "marketing",
        session: AsyncSession = None
    ) -> bool:
        """
        Check if email is unsubscribed from specific email type.

        Args:
            email: Email address
            email_type: Type of emails to check
            session: Database session

        Returns:
            True if unsubscribed
        """
        if session is None:
            async with get_db_session() as session:
                return await self.is_unsubscribed(email, email_type, session)

        # Check for specific type or "all" unsubscribes
        result = await session.execute(
            select(EmailUnsubscribe).where(
                and_(
                    EmailUnsubscribe.email == email,
                    or_(
                        EmailUnsubscribe.email_type == email_type,
                        EmailUnsubscribe.email_type == "all"
                    )
                )
            )
        )
        return result.scalar_one_or_none() is not None

    # Data Retention and Deletion
    async def get_data_for_deletion(
        self,
        policy_id: str,
        batch_size: int = 100,
        session: AsyncSession = None
    ) -> List[Dict[str, any]]:
        """
        Get data that should be deleted based on retention policy.

        Args:
            policy_id: Retention policy ID
            batch_size: Number of records to process
            session: Database session

        Returns:
            List of records to be deleted
        """
        if session is None:
            async with get_db_session() as session:
                return await self.get_data_for_deletion(policy_id, batch_size, session)

        # Get retention policy
        result = await session.execute(
            select(DataRetentionPolicy).where(DataRetentionPolicy.id == policy_id)
        )
        policy = result.scalar_one_or_none()

        if not policy or not policy.is_active:
            return []

        cutoff_date = datetime.utcnow() - timedelta(days=policy.retention_period_days)
        records_to_delete = []

        # Handle different data types
        if "bookings" in policy.data_types:
            booking_result = await session.execute(
                select(Booking.id, Booking.customer_id, Booking.created_at)
                .where(
                    and_(
                        Booking.created_at < cutoff_date,
                        Booking.status.in_(["completed", "cancelled"])
                    )
                )
                .limit(batch_size)
            )

            for booking in booking_result:
                records_to_delete.append({
                    "data_type": "booking",
                    "table_name": "bookings",
                    "record_id": booking.id,
                    "user_id": booking.customer_id,
                    "created_at": booking.created_at
                })

        if "email_queue" in policy.data_types:
            email_result = await session.execute(
                select(EmailQueue.id, EmailQueue.user_id, EmailQueue.created_at)
                .where(
                    and_(
                        EmailQueue.created_at < cutoff_date,
                        EmailQueue.status.in_(["sent", "failed"])
                    )
                )
                .limit(batch_size)
            )

            for email in email_result:
                records_to_delete.append({
                    "data_type": "email_queue",
                    "table_name": "email_queue",
                    "record_id": email.id,
                    "user_id": email.user_id,
                    "created_at": email.created_at
                })

        return records_to_delete

    async def delete_user_data(
        self,
        user_id: str,
        reason: str = "user_request",
        deleted_by: Optional[str] = None,
        session: AsyncSession = None
    ) -> Dict[str, int]:
        """
        Delete all data for a specific user (GDPR right to be forgotten).

        Args:
            user_id: User ID
            reason: Reason for deletion
            deleted_by: Who requested the deletion
            session: Database session

        Returns:
            Dictionary with count of deleted records by type
        """
        if session is None:
            async with get_db_session() as session:
                return await self.delete_user_data(user_id, reason, deleted_by, session)

        deletion_counts = {}

        # Delete bookings
        booking_result = await session.execute(
            select(Booking.id).where(Booking.customer_id == user_id)
        )
        booking_ids = [row[0] for row in booking_result]

        if booking_ids:
            await session.execute(
                delete(Booking).where(Booking.customer_id == user_id)
            )
            deletion_counts["bookings"] = len(booking_ids)

            # Log deletion
            await self._log_data_deletion(
                user_id=user_id,
                data_type="bookings",
                table_name="bookings",
                record_ids=booking_ids,
                deletion_reason=reason,
                deleted_by=deleted_by,
                session=session
            )

        # Delete email queue entries
        email_result = await session.execute(
            select(EmailQueue.id).where(EmailQueue.user_id == user_id)
        )
        email_ids = [row[0] for row in email_result]

        if email_ids:
            await session.execute(
                delete(EmailQueue).where(EmailQueue.user_id == user_id)
            )
            deletion_counts["email_queue"] = len(email_ids)

            await self._log_data_deletion(
                user_id=user_id,
                data_type="email_queue",
                table_name="email_queue",
                record_ids=email_ids,
                deletion_reason=reason,
                deleted_by=deleted_by,
                session=session
            )

        # Delete consent records
        consent_result = await session.execute(
            select(EmailConsent.id).where(EmailConsent.user_id == user_id)
        )
        consent_ids = [row[0] for row in consent_result]

        if consent_ids:
            await session.execute(
                delete(EmailConsent).where(EmailConsent.user_id == user_id)
            )
            deletion_counts["consent"] = len(consent_ids)

        await session.commit()

        logger.info(
            "User data deleted",
            user_id=user_id,
            deletion_counts=deletion_counts,
            reason=reason
        )

        return deletion_counts

    # Private Helper Methods
    async def _log_consent_changes(
        self,
        user_id: str,
        changes: Dict[str, Tuple[Optional[bool], bool]],
        change_method: str,
        changed_by: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        notes: Optional[str] = None,
        session: AsyncSession = None
    ) -> None:
        """Log consent changes for audit purposes."""
        for consent_type, (old_value, new_value) in changes.items():
            audit_log = ConsentAuditLog(
                user_id=user_id,
                consent_type=consent_type,
                previous_value=old_value,
                new_value=new_value,
                change_reason="consent_update",
                change_method=change_method,
                changed_at=datetime.utcnow(),
                changed_by=changed_by,
                ip_address=ip_address,
                user_agent=user_agent,
                notes=notes
            )
            session.add(audit_log)

    async def _log_data_deletion(
        self,
        user_id: Optional[str],
        data_type: str,
        table_name: str,
        record_ids: List[str],
        deletion_reason: str,
        deleted_by: Optional[str] = None,
        policy_id: Optional[str] = None,
        session: AsyncSession = None
    ) -> None:
        """Log data deletion for audit purposes."""
        deletion_log = DataDeletionLog(
            user_id=user_id,
            data_type=data_type,
            table_name=table_name,
            record_ids=record_ids,
            record_count=len(record_ids),
            deletion_reason=deletion_reason,
            policy_id=policy_id,
            deleted_at=datetime.utcnow(),
            deleted_by=deleted_by,
            verified_deleted=True
        )
        session.add(deletion_log)


# Create service instance
gdpr_service = GDPRService()