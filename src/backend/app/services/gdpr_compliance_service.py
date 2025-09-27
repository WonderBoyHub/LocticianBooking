"""
GDPR Compliance Service for Payment Data
Handles data protection, privacy rights, and compliance requirements for payment processing.
"""
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from uuid import UUID

import structlog
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger(__name__)


class GDPRComplianceService:
    """Service for GDPR compliance in payment processing."""

    def __init__(self):
        """Initialize GDPR compliance service."""
        # Data retention periods (in days)
        self.retention_periods = {
            'payment_transactions': 2555,  # 7 years (legal requirement)
            'subscription_data': 2555,     # 7 years (legal requirement)
            'customer_data': 1095,         # 3 years after last activity
            'audit_logs': 2555,            # 7 years (legal requirement)
            'fraud_assessments': 1095,     # 3 years
            'invoices': 2555,              # 7 years (tax requirement)
            'marketing_data': 730,         # 2 years
            'session_data': 30,            # 30 days
            'temporary_data': 7,           # 7 days
        }

        # Data processing purposes
        self.processing_purposes = {
            'payment_processing': 'Process payments and manage transactions',
            'fraud_prevention': 'Detect and prevent fraudulent activities',
            'legal_compliance': 'Comply with legal and regulatory requirements',
            'customer_service': 'Provide customer support and service',
            'business_operations': 'Manage subscriptions and business operations',
            'marketing': 'Send marketing communications (with consent)',
            'analytics': 'Analyze usage patterns and improve services',
        }

        # Legal bases for processing
        self.legal_bases = {
            'consent': 'User has given explicit consent',
            'contract': 'Processing is necessary for contract performance',
            'legal_obligation': 'Processing is required by law',
            'vital_interests': 'Processing protects vital interests',
            'public_task': 'Processing is for public interest',
            'legitimate_interest': 'Processing is for legitimate business interests',
        }

        logger.info("GDPR compliance service initialized")

    async def log_data_processing(
        self,
        user_id: UUID,
        data_type: str,
        processing_purpose: str,
        legal_basis: str,
        data_categories: List[str],
        automated_decision: bool = False,
        db: AsyncSession = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """Log data processing activity for GDPR compliance."""
        try:
            if not db:
                return

            await db.execute(
                text("""
                    INSERT INTO gdpr_processing_log (
                        id, user_id, data_type, processing_purpose, legal_basis,
                        data_categories, automated_decision, metadata, created_at
                    ) VALUES (
                        gen_random_uuid(), :user_id::uuid, :data_type, :processing_purpose,
                        :legal_basis, :data_categories::text[], :automated_decision,
                        :metadata::jsonb, NOW()
                    )
                """),
                {
                    "user_id": user_id,
                    "data_type": data_type,
                    "processing_purpose": processing_purpose,
                    "legal_basis": legal_basis,
                    "data_categories": data_categories,
                    "automated_decision": automated_decision,
                    "metadata": metadata or {}
                }
            )
            await db.commit()

            logger.debug(
                "Data processing logged",
                user_id=user_id,
                data_type=data_type,
                purpose=processing_purpose
            )

        except Exception as e:
            logger.error("Error logging data processing", error=str(e), user_id=user_id)

    async def record_consent(
        self,
        user_id: UUID,
        consent_type: str,
        consent_given: bool,
        consent_details: Dict[str, Any],
        db: AsyncSession,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> UUID:
        """Record user consent for GDPR compliance."""
        try:
            consent_id = await db.execute(
                text("""
                    INSERT INTO gdpr_consent_records (
                        id, user_id, consent_type, consent_given, consent_details,
                        ip_address, user_agent, created_at
                    ) VALUES (
                        gen_random_uuid(), :user_id::uuid, :consent_type, :consent_given,
                        :consent_details::jsonb, :ip_address, :user_agent, NOW()
                    ) RETURNING id
                """),
                {
                    "user_id": user_id,
                    "consent_type": consent_type,
                    "consent_given": consent_given,
                    "consent_details": consent_details,
                    "ip_address": ip_address,
                    "user_agent": user_agent
                }
            )

            consent_uuid = consent_id.scalar()
            await db.commit()

            # Update user consent status
            await self._update_user_consent_status(user_id, consent_type, consent_given, db)

            logger.info(
                "Consent recorded",
                user_id=user_id,
                consent_id=consent_uuid,
                consent_type=consent_type,
                given=consent_given
            )

            return consent_uuid

        except Exception as e:
            logger.error("Error recording consent", error=str(e), user_id=user_id)
            raise

    async def get_user_data_export(self, user_id: UUID, db: AsyncSession) -> Dict[str, Any]:
        """Generate complete data export for user (GDPR Right to Portability)."""
        try:
            export_data = {
                'export_date': datetime.utcnow().isoformat(),
                'user_id': str(user_id),
                'data_categories': {}
            }

            # User profile data
            user_data = await db.execute(
                text("""
                    SELECT u.*, up.*
                    FROM users u
                    LEFT JOIN user_profiles up ON u.id = up.user_id
                    WHERE u.id = :user_id::uuid
                """),
                {"user_id": user_id}
            )

            user = user_data.first()
            if user:
                export_data['data_categories']['profile'] = {
                    'personal_information': {
                        'first_name': user.first_name,
                        'last_name': user.last_name,
                        'email': user.email,
                        'phone': user.phone,
                        'date_of_birth': user.date_of_birth.isoformat() if user.date_of_birth else None,
                        'address': {
                            'street': user.street_address,
                            'city': user.city,
                            'postal_code': user.postal_code,
                            'country': user.country
                        },
                        'preferences': {
                            'language': user.preferred_language,
                            'timezone': user.timezone,
                            'marketing_consent': user.marketing_consent
                        }
                    },
                    'account_information': {
                        'account_created': user.created_at.isoformat(),
                        'last_login': user.last_login_at.isoformat() if user.last_login_at else None,
                        'account_status': user.status,
                        'role': user.role
                    }
                }

                if hasattr(user, 'bio') and user.bio:
                    export_data['data_categories']['profile']['business_profile'] = {
                        'bio': user.bio,
                        'specializations': user.specializations,
                        'years_experience': user.years_experience,
                        'certifications': user.certifications,
                        'business_hours': user.business_hours
                    }

            # Payment data
            payments = await db.execute(
                text("""
                    SELECT pt.*, pi.checkout_url, pi.mollie_payment_id
                    FROM payment_transactions pt
                    LEFT JOIN payment_intents pi ON pt.id = pi.id
                    WHERE pt.user_id = :user_id::uuid
                    ORDER BY pt.created_at DESC
                """),
                {"user_id": user_id}
            )

            payment_list = []
            for payment in payments.fetchall():
                payment_list.append({
                    'transaction_id': str(payment.id),
                    'amount': float(payment.amount),
                    'currency': payment.currency,
                    'status': payment.status,
                    'transaction_type': payment.transaction_type,
                    'description': payment.description,
                    'created_at': payment.created_at.isoformat(),
                    'processed_at': payment.processed_at.isoformat() if payment.processed_at else None,
                    'metadata': payment.metadata
                })

            export_data['data_categories']['payments'] = payment_list

            # Subscription data
            subscriptions = await db.execute(
                text("""
                    SELECT us.*, sp.name as plan_name, ss.name as status_name
                    FROM user_subscriptions us
                    JOIN subscription_plans sp ON us.plan_id = sp.id
                    JOIN subscription_statuses ss ON us.status_id = ss.id
                    WHERE us.user_id = :user_id::uuid
                    ORDER BY us.created_at DESC
                """),
                {"user_id": user_id}
            )

            subscription_list = []
            for sub in subscriptions.fetchall():
                subscription_list.append({
                    'subscription_id': str(sub.id),
                    'plan_name': sub.plan_name,
                    'status': sub.status_name,
                    'billing_period': sub.billing_period,
                    'amount': float(sub.plan_price),
                    'currency': sub.currency,
                    'started_at': sub.starts_at.isoformat(),
                    'current_period_start': sub.current_period_start.isoformat(),
                    'current_period_end': sub.current_period_end.isoformat(),
                    'trial_end': sub.trial_end.isoformat() if sub.trial_end else None,
                    'canceled_at': sub.cancelled_at.isoformat() if sub.cancelled_at else None,
                    'usage': {
                        'bookings_used': sub.bookings_used_this_period
                    }
                })

            export_data['data_categories']['subscriptions'] = subscription_list

            # Booking data
            bookings = await db.execute(
                text("""
                    SELECT b.*, s.name as service_name
                    FROM bookings b
                    JOIN services s ON b.service_id = s.id
                    WHERE b.customer_id = :user_id::uuid
                    ORDER BY b.created_at DESC
                """),
                {"user_id": user_id}
            )

            booking_list = []
            for booking in bookings.fetchall():
                booking_list.append({
                    'booking_id': str(booking.id),
                    'booking_number': booking.booking_number,
                    'service_name': booking.service_name,
                    'appointment_start': booking.appointment_start.isoformat(),
                    'appointment_end': booking.appointment_end.isoformat(),
                    'status': booking.status,
                    'payment_status': booking.payment_status,
                    'total_amount': float(booking.total_amount),
                    'customer_notes': booking.customer_notes,
                    'special_requests': booking.special_requests,
                    'created_at': booking.created_at.isoformat()
                })

            export_data['data_categories']['bookings'] = booking_list

            # Consent records
            consents = await db.execute(
                text("""
                    SELECT consent_type, consent_given, consent_details, created_at
                    FROM gdpr_consent_records
                    WHERE user_id = :user_id::uuid
                    ORDER BY created_at DESC
                """),
                {"user_id": user_id}
            )

            consent_list = []
            for consent in consents.fetchall():
                consent_list.append({
                    'consent_type': consent.consent_type,
                    'consent_given': consent.consent_given,
                    'details': consent.consent_details,
                    'recorded_at': consent.created_at.isoformat()
                })

            export_data['data_categories']['consent_records'] = consent_list

            # Log the data export request
            await self.log_data_processing(
                user_id=user_id,
                data_type='user_data_export',
                processing_purpose='data_portability',
                legal_basis='consent',
                data_categories=list(export_data['data_categories'].keys()),
                db=db,
                metadata={'export_categories': list(export_data['data_categories'].keys())}
            )

            logger.info("User data export generated", user_id=user_id)

            return export_data

        except Exception as e:
            logger.error("Error generating user data export", error=str(e), user_id=user_id)
            raise

    async def delete_user_data(
        self,
        user_id: UUID,
        deletion_type: str,
        reason: str,
        db: AsyncSession,
        retain_legal_data: bool = True
    ) -> Dict[str, Any]:
        """Delete user data (GDPR Right to Erasure)."""
        try:
            deletion_log = {
                'user_id': str(user_id),
                'deletion_type': deletion_type,
                'reason': reason,
                'deleted_at': datetime.utcnow().isoformat(),
                'retained_data': [],
                'deleted_data': []
            }

            # Always retain data required by law
            if retain_legal_data:
                deletion_log['retained_data'].extend([
                    'payment_transactions',
                    'subscription_invoices',
                    'fraud_assessments',
                    'audit_logs'
                ])

            # Anonymize user profile
            await db.execute(
                text("""
                    UPDATE users SET
                        email = 'deleted-' || id || '@anonymized.local',
                        phone = NULL,
                        first_name = 'Deleted',
                        last_name = 'User',
                        date_of_birth = NULL,
                        street_address = NULL,
                        city = NULL,
                        postal_code = NULL,
                        deleted_at = NOW(),
                        data_retention_until = NULL
                    WHERE id = :user_id::uuid
                """),
                {"user_id": user_id}
            )
            deletion_log['deleted_data'].append('user_profile')

            # Anonymize user profile data
            await db.execute(
                text("""
                    UPDATE user_profiles SET
                        bio = 'Profile deleted for GDPR compliance',
                        profile_image_url = NULL,
                        instagram_handle = NULL,
                        website_url = NULL,
                        allergies = NULL,
                        notes = 'Data anonymized'
                    WHERE user_id = :user_id::uuid
                """),
                {"user_id": user_id}
            )
            deletion_log['deleted_data'].append('user_profile_details')

            # Anonymize booking customer data
            await db.execute(
                text("""
                    UPDATE bookings SET
                        customer_notes = 'Customer data anonymized',
                        special_requests = NULL
                    WHERE customer_id = :user_id::uuid
                """),
                {"user_id": user_id}
            )
            deletion_log['deleted_data'].append('booking_customer_data')

            # Delete optional/marketing data if requested
            if deletion_type == 'complete':
                # Delete marketing consent
                await db.execute(
                    text("""
                        DELETE FROM gdpr_consent_records
                        WHERE user_id = :user_id::uuid
                        AND consent_type = 'marketing'
                    """),
                    {"user_id": user_id}
                )
                deletion_log['deleted_data'].append('marketing_consent')

                # Delete non-essential metadata
                await db.execute(
                    text("""
                        UPDATE payment_transactions SET
                            metadata = jsonb_build_object('anonymized', true)
                        WHERE user_id = :user_id::uuid
                    """),
                    {"user_id": user_id}
                )
                deletion_log['deleted_data'].append('payment_metadata')

            # Record the deletion
            await db.execute(
                text("""
                    INSERT INTO gdpr_deletion_log (
                        id, user_id, deletion_type, reason, deletion_log,
                        deleted_by, created_at
                    ) VALUES (
                        gen_random_uuid(), :user_id::uuid, :deletion_type, :reason,
                        :deletion_log::jsonb, :user_id::uuid, NOW()
                    )
                """),
                {
                    "user_id": user_id,
                    "deletion_type": deletion_type,
                    "reason": reason,
                    "deletion_log": deletion_log
                }
            )

            await db.commit()

            logger.info(
                "User data deletion completed",
                user_id=user_id,
                deletion_type=deletion_type,
                deleted_categories=len(deletion_log['deleted_data'])
            )

            return deletion_log

        except Exception as e:
            logger.error("Error deleting user data", error=str(e), user_id=user_id)
            await db.rollback()
            raise

    async def audit_data_retention(self, db: AsyncSession) -> Dict[str, Any]:
        """Audit data retention compliance and identify data for deletion."""
        try:
            audit_results = {
                'audit_date': datetime.utcnow().isoformat(),
                'tables_audited': [],
                'expired_data': {},
                'recommendations': []
            }

            # Check user data retention
            expired_users = await db.execute(
                text("""
                    SELECT id, email, data_retention_until
                    FROM users
                    WHERE data_retention_until < NOW()
                    AND deleted_at IS NULL
                """)
            )

            expired_user_list = []
            for user in expired_users.fetchall():
                expired_user_list.append({
                    'user_id': str(user.id),
                    'email': user.email,
                    'retention_expired': user.data_retention_until.isoformat()
                })

            if expired_user_list:
                audit_results['expired_data']['users'] = expired_user_list
                audit_results['recommendations'].append(
                    f"Anonymize {len(expired_user_list)} users with expired retention periods"
                )

            # Check old session data
            old_sessions = await db.execute(
                text("""
                    SELECT COUNT(*) as count
                    FROM audit_log
                    WHERE table_name = 'user_sessions'
                    AND created_at < NOW() - INTERVAL '30 days'
                """)
            )

            session_count = old_sessions.scalar()
            if session_count and session_count > 0:
                audit_results['expired_data']['sessions'] = session_count
                audit_results['recommendations'].append(
                    f"Delete {session_count} old session records"
                )

            # Check marketing data without consent
            marketing_data = await db.execute(
                text("""
                    SELECT COUNT(*) as count
                    FROM users
                    WHERE marketing_consent = false
                    AND last_login_at < NOW() - INTERVAL '2 years'
                    AND deleted_at IS NULL
                """)
            )

            marketing_count = marketing_data.scalar()
            if marketing_count and marketing_count > 0:
                audit_results['expired_data']['marketing_data'] = marketing_count
                audit_results['recommendations'].append(
                    f"Review {marketing_count} inactive users without marketing consent"
                )

            audit_results['tables_audited'] = [
                'users', 'user_profiles', 'audit_log', 'gdpr_consent_records'
            ]

            logger.info(
                "Data retention audit completed",
                expired_users=len(expired_user_list),
                recommendations=len(audit_results['recommendations'])
            )

            return audit_results

        except Exception as e:
            logger.error("Error auditing data retention", error=str(e))
            raise

    async def _update_user_consent_status(
        self,
        user_id: UUID,
        consent_type: str,
        consent_given: bool,
        db: AsyncSession
    ) -> None:
        """Update user consent status in the users table."""
        try:
            if consent_type == 'marketing':
                await db.execute(
                    text("""
                        UPDATE users SET
                            marketing_consent = :consent_given,
                            updated_at = NOW()
                        WHERE id = :user_id::uuid
                    """),
                    {"user_id": user_id, "consent_given": consent_given}
                )

            elif consent_type == 'gdpr_processing':
                await db.execute(
                    text("""
                        UPDATE users SET
                            gdpr_consent_date = CASE WHEN :consent_given THEN NOW() ELSE NULL END,
                            gdpr_consent_version = CASE WHEN :consent_given THEN '1.0' ELSE NULL END,
                            updated_at = NOW()
                        WHERE id = :user_id::uuid
                    """),
                    {"user_id": user_id, "consent_given": consent_given}
                )

            await db.commit()

        except Exception as e:
            logger.error("Error updating user consent status", error=str(e))

    async def get_privacy_dashboard_data(self, user_id: UUID, db: AsyncSession) -> Dict[str, Any]:
        """Get privacy dashboard data for user."""
        try:
            # Get current consent status
            user_consents = await db.execute(
                text("""
                    SELECT
                        u.marketing_consent,
                        u.gdpr_consent_date,
                        u.gdpr_consent_version,
                        u.data_retention_until
                    FROM users u
                    WHERE u.id = :user_id::uuid
                """),
                {"user_id": user_id}
            )

            user_data = user_consents.first()

            # Get recent consent records
            recent_consents = await db.execute(
                text("""
                    SELECT consent_type, consent_given, created_at
                    FROM gdpr_consent_records
                    WHERE user_id = :user_id::uuid
                    ORDER BY created_at DESC
                    LIMIT 10
                """),
                {"user_id": user_id}
            )

            consent_history = []
            for consent in recent_consents.fetchall():
                consent_history.append({
                    'type': consent.consent_type,
                    'given': consent.consent_given,
                    'date': consent.created_at.isoformat()
                })

            # Get data processing summary
            processing_summary = await db.execute(
                text("""
                    SELECT
                        processing_purpose,
                        COUNT(*) as activity_count,
                        MAX(created_at) as last_activity
                    FROM gdpr_processing_log
                    WHERE user_id = :user_id::uuid
                    AND created_at >= NOW() - INTERVAL '30 days'
                    GROUP BY processing_purpose
                    ORDER BY activity_count DESC
                """),
                {"user_id": user_id}
            )

            processing_activities = []
            for activity in processing_summary.fetchall():
                processing_activities.append({
                    'purpose': activity.processing_purpose,
                    'activity_count': activity.activity_count,
                    'last_activity': activity.last_activity.isoformat()
                })

            return {
                'user_id': str(user_id),
                'consent_status': {
                    'marketing': user_data.marketing_consent if user_data else False,
                    'gdpr_processing': user_data.gdpr_consent_date is not None if user_data else False,
                    'gdpr_version': user_data.gdpr_consent_version if user_data else None
                },
                'data_retention': {
                    'retention_until': user_data.data_retention_until.isoformat() if user_data and user_data.data_retention_until else None,
                    'can_request_deletion': True
                },
                'consent_history': consent_history,
                'processing_activities': processing_activities,
                'privacy_rights': {
                    'data_export': 'Available',
                    'data_deletion': 'Available',
                    'data_rectification': 'Available',
                    'processing_restriction': 'Available',
                    'data_portability': 'Available'
                }
            }

        except Exception as e:
            logger.error("Error getting privacy dashboard data", error=str(e), user_id=user_id)
            raise


# Global service instance
gdpr_compliance_service = GDPRComplianceService()