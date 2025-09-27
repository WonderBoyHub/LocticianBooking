"""
Fraud Detection and Security Service
Implements fraud detection, risk assessment, and security monitoring for payments.
"""
import hashlib
import re
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Tuple, Any
from uuid import UUID

import structlog
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger(__name__)


class FraudDetectionService:
    """Service for detecting fraudulent activities and assessing payment risks."""

    def __init__(self):
        """Initialize fraud detection service."""
        # Risk scoring thresholds
        self.risk_thresholds = {
            'low': 0.2,      # 0-20% risk
            'medium': 0.5,   # 21-50% risk
            'high': 0.8,     # 51-80% risk
            'critical': 1.0  # 81-100% risk
        }

        # Velocity limits (per time period)
        self.velocity_limits = {
            'payments_per_hour': 10,
            'payments_per_day': 50,
            'failed_attempts_per_hour': 5,
            'max_amount_per_hour': Decimal('50000.00'),  # DKK
            'new_customer_limit_per_day': Decimal('5000.00'),  # DKK
        }

        # Suspicious patterns
        self.suspicious_patterns = {
            'rapid_fire_payments': 5,  # More than 5 payments in 10 minutes
            'amount_variation_threshold': 0.95,  # Similar amounts (>95% similarity)
            'geographic_velocity': 3,  # Payments from different countries within 1 hour
            'payment_method_switching': 4,  # More than 4 different payment methods
        }

        logger.info("Fraud detection service initialized")

    async def assess_payment_risk(
        self,
        user_id: UUID,
        amount: Decimal,
        currency: str,
        payment_method: str,
        ip_address: str,
        user_agent: str,
        db: AsyncSession,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Tuple[str, float, Dict[str, Any]]:
        """
        Assess the risk level of a payment attempt.
        Returns (risk_level, risk_score, risk_factors)
        """
        try:
            risk_factors = {}
            risk_score = 0.0

            # User behavior analysis
            user_risk = await self._analyze_user_behavior(user_id, db)
            risk_score += user_risk['score']
            if user_risk['factors']:
                risk_factors['user_behavior'] = user_risk['factors']

            # Amount analysis
            amount_risk = await self._analyze_amount_patterns(user_id, amount, currency, db)
            risk_score += amount_risk['score']
            if amount_risk['factors']:
                risk_factors['amount_patterns'] = amount_risk['factors']

            # Velocity analysis
            velocity_risk = await self._analyze_velocity_patterns(user_id, ip_address, db)
            risk_score += velocity_risk['score']
            if velocity_risk['factors']:
                risk_factors['velocity'] = velocity_risk['factors']

            # Geographic analysis
            geo_risk = await self._analyze_geographic_patterns(user_id, ip_address, db)
            risk_score += geo_risk['score']
            if geo_risk['factors']:
                risk_factors['geographic'] = geo_risk['factors']

            # Payment method analysis
            method_risk = await self._analyze_payment_method_patterns(user_id, payment_method, db)
            risk_score += method_risk['score']
            if method_risk['factors']:
                risk_factors['payment_method'] = method_risk['factors']

            # Device/Browser fingerprinting
            device_risk = await self._analyze_device_patterns(user_id, user_agent, ip_address, db)
            risk_score += device_risk['score']
            if device_risk['factors']:
                risk_factors['device'] = device_risk['factors']

            # Time-based analysis
            time_risk = self._analyze_time_patterns(metadata)
            risk_score += time_risk['score']
            if time_risk['factors']:
                risk_factors['timing'] = time_risk['factors']

            # Normalize risk score (0-1 scale)
            risk_score = min(risk_score, 1.0)

            # Determine risk level
            risk_level = self._get_risk_level(risk_score)

            # Log risk assessment
            await self._log_risk_assessment(
                user_id, amount, currency, risk_level, risk_score, risk_factors, db
            )

            logger.info(
                "Payment risk assessed",
                user_id=user_id,
                amount=float(amount),
                risk_level=risk_level,
                risk_score=risk_score,
                factors_count=len(risk_factors)
            )

            return risk_level, risk_score, risk_factors

        except Exception as e:
            logger.error("Error assessing payment risk", error=str(e), user_id=user_id)
            # Default to medium risk if analysis fails
            return 'medium', 0.5, {'error': 'Risk analysis failed'}

    async def _analyze_user_behavior(self, user_id: UUID, db: AsyncSession) -> Dict[str, Any]:
        """Analyze user's historical behavior patterns."""
        factors = []
        score = 0.0

        try:
            # Get user account age
            user_query = await db.execute(
                text("SELECT created_at FROM users WHERE id = :user_id::uuid"),
                {"user_id": user_id}
            )
            user = user_query.first()

            if user:
                account_age = (datetime.utcnow() - user.created_at).days
                if account_age < 1:
                    factors.append("Very new account (less than 1 day)")
                    score += 0.3
                elif account_age < 7:
                    factors.append("New account (less than 1 week)")
                    score += 0.2
                elif account_age < 30:
                    factors.append("Relatively new account (less than 1 month)")
                    score += 0.1

            # Analyze payment history
            payment_history = await db.execute(
                text("""
                    SELECT
                        COUNT(*) as total_payments,
                        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_payments,
                        COUNT(CASE WHEN status = 'succeeded' THEN 1 END) as successful_payments,
                        MAX(created_at) as last_payment
                    FROM payment_transactions
                    WHERE user_id = :user_id::uuid
                    AND created_at >= NOW() - INTERVAL '30 days'
                """),
                {"user_id": user_id}
            )

            history = payment_history.first()
            if history:
                # High failure rate
                if history.total_payments > 0:
                    failure_rate = history.failed_payments / history.total_payments
                    if failure_rate > 0.5:
                        factors.append(f"High payment failure rate ({failure_rate:.1%})")
                        score += 0.4
                    elif failure_rate > 0.3:
                        factors.append(f"Elevated payment failure rate ({failure_rate:.1%})")
                        score += 0.2

                # Too many recent payments
                if history.total_payments > 20:
                    factors.append(f"High payment volume ({history.total_payments} in 30 days)")
                    score += 0.2

            # Check for recent account changes
            profile_changes = await db.execute(
                text("""
                    SELECT COUNT(*) as changes
                    FROM audit_log
                    WHERE table_name = 'users' AND record_id = :user_id::uuid
                    AND created_at >= NOW() - INTERVAL '7 days'
                    AND action = 'UPDATE'
                """),
                {"user_id": user_id}
            )

            changes = profile_changes.scalar()
            if changes and changes > 5:
                factors.append(f"Frequent profile changes ({changes} in last week)")
                score += 0.2

        except Exception as e:
            logger.error("Error analyzing user behavior", error=str(e))
            factors.append("Could not analyze user behavior")
            score += 0.1

        return {'score': score, 'factors': factors}

    async def _analyze_amount_patterns(
        self, user_id: UUID, amount: Decimal, currency: str, db: AsyncSession
    ) -> Dict[str, Any]:
        """Analyze payment amount patterns for suspicious activity."""
        factors = []
        score = 0.0

        try:
            # Check for unusually high amounts
            user_avg = await db.execute(
                text("""
                    SELECT
                        AVG(amount) as avg_amount,
                        MAX(amount) as max_amount,
                        COUNT(*) as payment_count
                    FROM payment_transactions
                    WHERE user_id = :user_id::uuid
                    AND currency = :currency
                    AND status = 'succeeded'
                    AND created_at >= NOW() - INTERVAL '90 days'
                """),
                {"user_id": user_id, "currency": currency}
            )

            avg_data = user_avg.first()
            if avg_data and avg_data.avg_amount:
                avg_amount = Decimal(str(avg_data.avg_amount))
                max_amount = Decimal(str(avg_data.max_amount))

                # Amount significantly higher than average
                if amount > avg_amount * 5:
                    factors.append(f"Amount {amount} is 5x higher than user's average {avg_amount:.2f}")
                    score += 0.3
                elif amount > avg_amount * 3:
                    factors.append(f"Amount {amount} is 3x higher than user's average {avg_amount:.2f}")
                    score += 0.2

                # Amount higher than previous maximum
                if amount > max_amount * 2:
                    factors.append(f"Amount {amount} is 2x higher than previous maximum {max_amount}")
                    score += 0.2

            # Check for round number amounts (potential fraud pattern)
            if amount % 100 == 0 and amount >= 1000:
                factors.append(f"Round number amount ({amount}) may indicate fraud")
                score += 0.1

            # Check for very small amounts (card testing)
            if amount < Decimal('10.00'):
                factors.append(f"Very small amount ({amount}) may indicate card testing")
                score += 0.2

            # Check recent similar amounts
            similar_amounts = await db.execute(
                text("""
                    SELECT COUNT(*) as similar_count
                    FROM payment_transactions
                    WHERE user_id = :user_id::uuid
                    AND ABS(amount - :amount) < :amount * 0.05
                    AND created_at >= NOW() - INTERVAL '24 hours'
                    AND id != :current_id
                """),
                {
                    "user_id": user_id,
                    "amount": amount,
                    "current_id": "00000000-0000-0000-0000-000000000000"  # Placeholder
                }
            )

            similar_count = similar_amounts.scalar()
            if similar_count and similar_count > 3:
                factors.append(f"Multiple similar amounts in 24 hours ({similar_count} payments)")
                score += 0.3

        except Exception as e:
            logger.error("Error analyzing amount patterns", error=str(e))

        return {'score': score, 'factors': factors}

    async def _analyze_velocity_patterns(self, user_id: UUID, ip_address: str, db: AsyncSession) -> Dict[str, Any]:
        """Analyze velocity patterns for rapid-fire attacks."""
        factors = []
        score = 0.0

        try:
            # Check payments in last hour
            hourly_payments = await db.execute(
                text("""
                    SELECT COUNT(*) as payment_count
                    FROM payment_transactions
                    WHERE user_id = :user_id::uuid
                    AND created_at >= NOW() - INTERVAL '1 hour'
                """),
                {"user_id": user_id}
            )

            hourly_count = hourly_payments.scalar()
            if hourly_count and hourly_count > self.velocity_limits['payments_per_hour']:
                factors.append(f"Too many payments in 1 hour ({hourly_count})")
                score += 0.4

            # Check payments in last 10 minutes
            rapid_payments = await db.execute(
                text("""
                    SELECT COUNT(*) as payment_count
                    FROM payment_transactions
                    WHERE user_id = :user_id::uuid
                    AND created_at >= NOW() - INTERVAL '10 minutes'
                """),
                {"user_id": user_id}
            )

            rapid_count = rapid_payments.scalar()
            if rapid_count and rapid_count > self.suspicious_patterns['rapid_fire_payments']:
                factors.append(f"Rapid-fire payments ({rapid_count} in 10 minutes)")
                score += 0.5

            # Check failed attempts
            failed_attempts = await db.execute(
                text("""
                    SELECT COUNT(*) as failed_count
                    FROM payment_transactions
                    WHERE user_id = :user_id::uuid
                    AND status = 'failed'
                    AND created_at >= NOW() - INTERVAL '1 hour'
                """),
                {"user_id": user_id}
            )

            failed_count = failed_attempts.scalar()
            if failed_count and failed_count > self.velocity_limits['failed_attempts_per_hour']:
                factors.append(f"Too many failed attempts ({failed_count} in 1 hour)")
                score += 0.6

            # Check IP-based velocity
            ip_payments = await db.execute(
                text("""
                    SELECT COUNT(DISTINCT user_id) as unique_users
                    FROM payment_transactions pt
                    JOIN audit_log al ON al.record_id = pt.id
                    WHERE al.ip_address = :ip_address
                    AND pt.created_at >= NOW() - INTERVAL '1 hour'
                """),
                {"ip_address": ip_address}
            )

            ip_users = ip_payments.scalar()
            if ip_users and ip_users > 5:
                factors.append(f"Multiple users from same IP ({ip_users} users)")
                score += 0.3

        except Exception as e:
            logger.error("Error analyzing velocity patterns", error=str(e))

        return {'score': score, 'factors': factors}

    async def _analyze_geographic_patterns(self, user_id: UUID, ip_address: str, db: AsyncSession) -> Dict[str, Any]:
        """Analyze geographic patterns and impossible travel."""
        factors = []
        score = 0.0

        try:
            # Get country from IP (simplified - in production use GeoIP service)
            current_country = self._get_country_from_ip(ip_address)

            # Check user's typical country
            typical_country = await db.execute(
                text("""
                    SELECT country FROM users WHERE id = :user_id::uuid
                """),
                {"user_id": user_id}
            )

            user_country = typical_country.scalar()
            if user_country and current_country and current_country != user_country:
                factors.append(f"Payment from different country ({current_country} vs {user_country})")
                score += 0.2

            # Check for rapid geographic changes
            recent_locations = await db.execute(
                text("""
                    SELECT DISTINCT al.ip_address, pt.created_at
                    FROM payment_transactions pt
                    JOIN audit_log al ON al.record_id = pt.id
                    WHERE pt.user_id = :user_id::uuid
                    AND pt.created_at >= NOW() - INTERVAL '24 hours'
                    ORDER BY pt.created_at DESC
                    LIMIT 10
                """),
                {"user_id": user_id}
            )

            locations = recent_locations.fetchall()
            unique_countries = set()
            for location in locations:
                country = self._get_country_from_ip(location.ip_address)
                if country:
                    unique_countries.add(country)

            if len(unique_countries) > self.suspicious_patterns['geographic_velocity']:
                factors.append(f"Multiple countries in 24 hours ({len(unique_countries)} countries)")
                score += 0.4

        except Exception as e:
            logger.error("Error analyzing geographic patterns", error=str(e))

        return {'score': score, 'factors': factors}

    async def _analyze_payment_method_patterns(self, user_id: UUID, payment_method: str, db: AsyncSession) -> Dict[str, Any]:
        """Analyze payment method switching patterns."""
        factors = []
        score = 0.0

        try:
            # Check for multiple payment methods
            methods_used = await db.execute(
                text("""
                    SELECT COUNT(DISTINCT payment_method_type) as method_count
                    FROM payment_transactions
                    WHERE user_id = :user_id::uuid
                    AND created_at >= NOW() - INTERVAL '7 days'
                """),
                {"user_id": user_id}
            )

            method_count = methods_used.scalar()
            if method_count and method_count > self.suspicious_patterns['payment_method_switching']:
                factors.append(f"Multiple payment methods ({method_count} in 7 days)")
                score += 0.3

            # Check for new payment method
            previous_methods = await db.execute(
                text("""
                    SELECT DISTINCT payment_method_type
                    FROM payment_transactions
                    WHERE user_id = :user_id::uuid
                    AND payment_method_type = :payment_method
                    AND status = 'succeeded'
                """),
                {"user_id": user_id, "payment_method": payment_method}
            )

            if not previous_methods.first():
                factors.append(f"First time using payment method: {payment_method}")
                score += 0.1

        except Exception as e:
            logger.error("Error analyzing payment method patterns", error=str(e))

        return {'score': score, 'factors': factors}

    async def _analyze_device_patterns(self, user_id: UUID, user_agent: str, ip_address: str, db: AsyncSession) -> Dict[str, Any]:
        """Analyze device and browser fingerprinting patterns."""
        factors = []
        score = 0.0

        try:
            # Create device fingerprint
            device_fingerprint = hashlib.md5(f"{user_agent}{ip_address}".encode()).hexdigest()

            # Check for new device
            known_devices = await db.execute(
                text("""
                    SELECT COUNT(*) as device_count
                    FROM audit_log
                    WHERE user_id = :user_id::uuid
                    AND user_agent = :user_agent
                    AND created_at >= NOW() - INTERVAL '30 days'
                """),
                {"user_id": user_id, "user_agent": user_agent}
            )

            if not known_devices.scalar():
                factors.append("Payment from new device/browser")
                score += 0.2

            # Check for suspicious user agents
            suspicious_agents = [
                'curl', 'wget', 'python', 'bot', 'spider', 'crawler',
                'automated', 'script', 'tool'
            ]

            if any(agent in user_agent.lower() for agent in suspicious_agents):
                factors.append("Suspicious user agent detected")
                score += 0.5

            # Check for missing or minimal user agent
            if not user_agent or len(user_agent) < 20:
                factors.append("Missing or minimal user agent")
                score += 0.3

        except Exception as e:
            logger.error("Error analyzing device patterns", error=str(e))

        return {'score': score, 'factors': factors}

    def _analyze_time_patterns(self, metadata: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze timing patterns for suspicious activity."""
        factors = []
        score = 0.0

        try:
            current_time = datetime.utcnow()
            hour = current_time.hour

            # Payments during unusual hours (2 AM - 6 AM UTC)
            if 2 <= hour <= 6:
                factors.append(f"Payment during unusual hours ({hour}:00 UTC)")
                score += 0.1

            # Weekend payments (might be suspicious for B2B)
            if current_time.weekday() >= 5:  # Saturday = 5, Sunday = 6
                factors.append("Weekend payment")
                score += 0.05

        except Exception as e:
            logger.error("Error analyzing time patterns", error=str(e))

        return {'score': score, 'factors': factors}

    def _get_risk_level(self, risk_score: float) -> str:
        """Convert risk score to risk level."""
        if risk_score <= self.risk_thresholds['low']:
            return 'low'
        elif risk_score <= self.risk_thresholds['medium']:
            return 'medium'
        elif risk_score <= self.risk_thresholds['high']:
            return 'high'
        else:
            return 'critical'

    def _get_country_from_ip(self, ip_address: str) -> Optional[str]:
        """Get country code from IP address (simplified implementation)."""
        # In production, use a proper GeoIP service like MaxMind
        # This is a simplified placeholder
        if ip_address.startswith('127.') or ip_address.startswith('192.168.'):
            return 'DK'  # Local/private IP, assume Denmark

        # Add more sophisticated IP geolocation logic here
        return None

    async def _log_risk_assessment(
        self,
        user_id: UUID,
        amount: Decimal,
        currency: str,
        risk_level: str,
        risk_score: float,
        risk_factors: Dict[str, Any],
        db: AsyncSession
    ):
        """Log risk assessment for audit purposes."""
        try:
            await db.execute(
                text("""
                    INSERT INTO fraud_assessments (
                        id, user_id, amount, currency, risk_level, risk_score,
                        risk_factors, created_at
                    ) VALUES (
                        gen_random_uuid(), :user_id::uuid, :amount, :currency, :risk_level,
                        :risk_score, :risk_factors::jsonb, NOW()
                    )
                """),
                {
                    "user_id": user_id,
                    "amount": amount,
                    "currency": currency,
                    "risk_level": risk_level,
                    "risk_score": risk_score,
                    "risk_factors": risk_factors
                }
            )
            await db.commit()
        except Exception as e:
            logger.error("Error logging risk assessment", error=str(e))

    async def should_block_payment(
        self,
        risk_level: str,
        risk_score: float,
        user_id: UUID,
        db: AsyncSession
    ) -> Tuple[bool, str]:
        """Determine if payment should be blocked based on risk assessment."""
        try:
            # Always block critical risk
            if risk_level == 'critical':
                return True, "Payment blocked due to critical fraud risk"

            # Block high risk for new users
            if risk_level == 'high':
                user_query = await db.execute(
                    text("SELECT created_at FROM users WHERE id = :user_id::uuid"),
                    {"user_id": user_id}
                )
                user = user_query.first()

                if user and (datetime.utcnow() - user.created_at).days < 7:
                    return True, "Payment blocked due to high risk on new account"

            # Block if too many recent blocks
            recent_blocks = await db.execute(
                text("""
                    SELECT COUNT(*) as block_count
                    FROM fraud_assessments
                    WHERE user_id = :user_id::uuid
                    AND risk_level IN ('high', 'critical')
                    AND created_at >= NOW() - INTERVAL '24 hours'
                """),
                {"user_id": user_id}
            )

            if recent_blocks.scalar() and recent_blocks.scalar() >= 3:
                return True, "Payment blocked due to multiple high-risk attempts"

            return False, "Payment allowed"

        except Exception as e:
            logger.error("Error determining payment block", error=str(e))
            # Err on the side of caution
            return True, "Payment blocked due to system error"


# Global service instance
fraud_detection_service = FraudDetectionService()