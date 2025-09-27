"""
Analytics service for the Loctician Booking System.
Provides comprehensive business metrics, customer insights, and operational analytics.
"""
import csv
import io
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

import structlog
from sqlalchemy import and_, desc, extract, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db_session
from app.models.booking import Booking, BookingProduct, BookingService
from app.models.email_template import EmailQueue
from app.models.enums import BookingStatus, EmailStatus, PaymentStatus
from app.models.service import Service
from app.models.user import User

logger = structlog.get_logger(__name__)


class AnalyticsService:
    """Main analytics service for business intelligence and reporting."""

    def __init__(self):
        """Initialize analytics service."""
        pass

    # Revenue Analytics
    async def get_revenue_overview(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        loctician_id: Optional[str] = None,
        session: AsyncSession = None
    ) -> Dict[str, Any]:
        """
        Get revenue overview with key metrics.

        Args:
            start_date: Start date for analysis
            end_date: End date for analysis
            loctician_id: Optional loctician filter
            session: Database session

        Returns:
            Revenue overview dictionary
        """
        if session is None:
            async with get_db_session() as session:
                return await self.get_revenue_overview(
                    start_date, end_date, loctician_id, session
                )

        # Default to last 30 days
        if not end_date:
            end_date = datetime.utcnow()
        if not start_date:
            start_date = end_date - timedelta(days=30)

        # Build base query
        query_conditions = [
            Booking.appointment_start >= start_date,
            Booking.appointment_start <= end_date,
            Booking.status.in_([BookingStatus.COMPLETED, BookingStatus.CONFIRMED])
        ]

        if loctician_id:
            query_conditions.append(Booking.loctician_id == loctician_id)

        # Total revenue
        total_revenue_result = await session.execute(
            select(func.sum(Booking.total_amount))
            .where(and_(*query_conditions))
        )
        total_revenue = total_revenue_result.scalar() or Decimal("0")

        # Number of bookings
        bookings_count_result = await session.execute(
            select(func.count(Booking.id))
            .where(and_(*query_conditions))
        )
        bookings_count = bookings_count_result.scalar() or 0

        # Average booking value
        avg_booking_value = (
            total_revenue / bookings_count if bookings_count > 0 else Decimal("0")
        )

        # Revenue by status
        status_revenue_result = await session.execute(
            select(
                Booking.payment_status,
                func.sum(Booking.total_amount).label("revenue"),
                func.count(Booking.id).label("count")
            )
            .where(and_(*query_conditions))
            .group_by(Booking.payment_status)
        )
        status_breakdown = {
            row[0]: {"revenue": float(row[1]), "count": row[2]}
            for row in status_revenue_result
        }

        # Daily revenue trend (last 30 days)
        daily_revenue_result = await session.execute(
            select(
                func.date(Booking.appointment_start).label("date"),
                func.sum(Booking.total_amount).label("revenue"),
                func.count(Booking.id).label("bookings")
            )
            .where(and_(*query_conditions))
            .group_by(func.date(Booking.appointment_start))
            .order_by(func.date(Booking.appointment_start))
        )

        daily_trends = [
            {
                "date": row[0].isoformat(),
                "revenue": float(row[1]),
                "bookings": row[2]
            }
            for row in daily_revenue_result
        ]

        return {
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "days": (end_date - start_date).days
            },
            "total_revenue": float(total_revenue),
            "bookings_count": bookings_count,
            "average_booking_value": float(avg_booking_value),
            "payment_status_breakdown": status_breakdown,
            "daily_trends": daily_trends
        }

    async def get_service_performance(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        loctician_id: Optional[str] = None,
        session: AsyncSession = None
    ) -> List[Dict[str, Any]]:
        """
        Get service performance analytics.

        Args:
            start_date: Start date for analysis
            end_date: End date for analysis
            loctician_id: Optional loctician filter
            session: Database session

        Returns:
            List of service performance metrics
        """
        if session is None:
            async with get_db_session() as session:
                return await self.get_service_performance(
                    start_date, end_date, loctician_id, session
                )

        # Default to last 30 days
        if not end_date:
            end_date = datetime.utcnow()
        if not start_date:
            start_date = end_date - timedelta(days=30)

        # Build query conditions
        query_conditions = [
            Booking.appointment_start >= start_date,
            Booking.appointment_start <= end_date,
            Booking.status != BookingStatus.CANCELLED
        ]

        if loctician_id:
            query_conditions.append(Booking.loctician_id == loctician_id)

        # Service performance query
        result = await session.execute(
            select(
                Service.id,
                Service.name,
                Service.base_price,
                func.count(Booking.id).label("bookings_count"),
                func.sum(Booking.total_amount).label("total_revenue"),
                func.avg(Booking.total_amount).label("avg_revenue"),
                func.count(
                    func.case(
                        (Booking.status == BookingStatus.COMPLETED, 1),
                        else_=None
                    )
                ).label("completed_count"),
                func.count(
                    func.case(
                        (Booking.status == BookingStatus.CANCELLED, 1),
                        else_=None
                    )
                ).label("cancelled_count")
            )
            .join(Service, Booking.service_id == Service.id)
            .where(and_(*query_conditions))
            .group_by(Service.id, Service.name, Service.base_price)
            .order_by(desc("total_revenue"))
        )

        services = []
        for row in result:
            completion_rate = (
                (row.completed_count / row.bookings_count * 100)
                if row.bookings_count > 0 else 0
            )
            cancellation_rate = (
                (row.cancelled_count / row.bookings_count * 100)
                if row.bookings_count > 0 else 0
            )

            services.append({
                "service_id": row.id,
                "service_name": row.name,
                "base_price": float(row.base_price),
                "bookings_count": row.bookings_count,
                "total_revenue": float(row.total_revenue or 0),
                "average_revenue": float(row.avg_revenue or 0),
                "completed_count": row.completed_count,
                "cancelled_count": row.cancelled_count,
                "completion_rate": round(completion_rate, 2),
                "cancellation_rate": round(cancellation_rate, 2)
            })

        return services

    # Customer Analytics
    async def get_customer_insights(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        session: AsyncSession = None
    ) -> Dict[str, Any]:
        """
        Get comprehensive customer insights.

        Args:
            start_date: Start date for analysis
            end_date: End date for analysis
            session: Database session

        Returns:
            Customer insights dictionary
        """
        if session is None:
            async with get_db_session() as session:
                return await self.get_customer_insights(start_date, end_date, session)

        # Default to last 30 days
        if not end_date:
            end_date = datetime.utcnow()
        if not start_date:
            start_date = end_date - timedelta(days=30)

        # Total customers
        total_customers_result = await session.execute(
            select(func.count(func.distinct(User.id)))
            .where(User.role == "customer")
        )
        total_customers = total_customers_result.scalar() or 0

        # New customers in period
        new_customers_result = await session.execute(
            select(func.count(User.id))
            .where(
                and_(
                    User.role == "customer",
                    User.created_at >= start_date,
                    User.created_at <= end_date
                )
            )
        )
        new_customers = new_customers_result.scalar() or 0

        # Active customers (made bookings in period)
        active_customers_result = await session.execute(
            select(func.count(func.distinct(Booking.customer_id)))
            .where(
                and_(
                    Booking.appointment_start >= start_date,
                    Booking.appointment_start <= end_date,
                    Booking.status != BookingStatus.CANCELLED
                )
            )
        )
        active_customers = active_customers_result.scalar() or 0

        # Customer lifetime value analysis
        clv_result = await session.execute(
            select(
                Booking.customer_id,
                func.count(Booking.id).label("total_bookings"),
                func.sum(Booking.total_amount).label("total_spent"),
                func.min(Booking.appointment_start).label("first_booking"),
                func.max(Booking.appointment_start).label("last_booking")
            )
            .where(Booking.status != BookingStatus.CANCELLED)
            .group_by(Booking.customer_id)
        )

        clv_data = []
        for row in clv_result:
            days_as_customer = (row.last_booking - row.first_booking).days + 1
            clv_data.append({
                "customer_id": row.customer_id,
                "total_bookings": row.total_bookings,
                "total_spent": float(row.total_spent),
                "days_as_customer": days_as_customer,
                "avg_booking_value": float(row.total_spent / row.total_bookings),
                "booking_frequency": row.total_bookings / max(days_as_customer / 30, 1)  # per month
            })

        # Calculate averages
        if clv_data:
            avg_clv = sum(c["total_spent"] for c in clv_data) / len(clv_data)
            avg_booking_frequency = sum(c["booking_frequency"] for c in clv_data) / len(clv_data)
            avg_bookings_per_customer = sum(c["total_bookings"] for c in clv_data) / len(clv_data)
        else:
            avg_clv = avg_booking_frequency = avg_bookings_per_customer = 0

        # Customer segments (by booking count)
        segments = {
            "new_customers": len([c for c in clv_data if c["total_bookings"] == 1]),
            "regular_customers": len([c for c in clv_data if 2 <= c["total_bookings"] <= 5]),
            "loyal_customers": len([c for c in clv_data if c["total_bookings"] > 5])
        }

        return {
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            "total_customers": total_customers,
            "new_customers": new_customers,
            "active_customers": active_customers,
            "customer_retention_rate": (
                (active_customers / total_customers * 100) if total_customers > 0 else 0
            ),
            "average_clv": round(avg_clv, 2),
            "average_booking_frequency": round(avg_booking_frequency, 2),
            "average_bookings_per_customer": round(avg_bookings_per_customer, 2),
            "customer_segments": segments
        }

    async def get_top_customers(
        self,
        limit: int = 10,
        order_by: str = "revenue",
        session: AsyncSession = None
    ) -> List[Dict[str, Any]]:
        """
        Get top customers by revenue or booking count.

        Args:
            limit: Number of customers to return
            order_by: Order by 'revenue' or 'bookings'
            session: Database session

        Returns:
            List of top customers
        """
        if session is None:
            async with get_db_session() as session:
                return await self.get_top_customers(limit, order_by, session)

        # Build order clause
        if order_by == "revenue":
            order_clause = desc("total_revenue")
        else:
            order_clause = desc("booking_count")

        result = await session.execute(
            select(
                User.id,
                User.first_name,
                User.last_name,
                User.email,
                User.phone,
                func.count(Booking.id).label("booking_count"),
                func.sum(Booking.total_amount).label("total_revenue"),
                func.avg(Booking.total_amount).label("avg_booking_value"),
                func.min(Booking.appointment_start).label("first_booking"),
                func.max(Booking.appointment_start).label("last_booking")
            )
            .join(Booking, User.id == Booking.customer_id)
            .where(Booking.status != BookingStatus.CANCELLED)
            .group_by(User.id, User.first_name, User.last_name, User.email, User.phone)
            .order_by(order_clause)
            .limit(limit)
        )

        customers = []
        for row in result:
            customers.append({
                "customer_id": row.id,
                "name": f"{row.first_name} {row.last_name}",
                "email": row.email,
                "phone": row.phone,
                "booking_count": row.booking_count,
                "total_revenue": float(row.total_revenue),
                "average_booking_value": float(row.avg_booking_value),
                "first_booking": row.first_booking.isoformat(),
                "last_booking": row.last_booking.isoformat(),
                "customer_since_days": (datetime.utcnow() - row.first_booking).days
            })

        return customers

    # Operational Analytics
    async def get_booking_analytics(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        loctician_id: Optional[str] = None,
        session: AsyncSession = None
    ) -> Dict[str, Any]:
        """
        Get comprehensive booking analytics.

        Args:
            start_date: Start date for analysis
            end_date: End date for analysis
            loctician_id: Optional loctician filter
            session: Database session

        Returns:
            Booking analytics dictionary
        """
        if session is None:
            async with get_db_session() as session:
                return await self.get_booking_analytics(
                    start_date, end_date, loctician_id, session
                )

        # Default to last 30 days
        if not end_date:
            end_date = datetime.utcnow()
        if not start_date:
            start_date = end_date - timedelta(days=30)

        # Build query conditions
        query_conditions = [
            Booking.appointment_start >= start_date,
            Booking.appointment_start <= end_date
        ]

        if loctician_id:
            query_conditions.append(Booking.loctician_id == loctician_id)

        # Booking status distribution
        status_result = await session.execute(
            select(
                Booking.status,
                func.count(Booking.id).label("count")
            )
            .where(and_(*query_conditions))
            .group_by(Booking.status)
        )

        status_distribution = {
            row[0]: row[1] for row in status_result
        }

        # No-show rate
        total_bookings = sum(status_distribution.values())
        no_shows = status_distribution.get(BookingStatus.NO_SHOW, 0)
        no_show_rate = (no_shows / total_bookings * 100) if total_bookings > 0 else 0

        # Cancellation analysis
        cancellations = status_distribution.get(BookingStatus.CANCELLED, 0)
        cancellation_rate = (cancellations / total_bookings * 100) if total_bookings > 0 else 0

        # Average lead time (time between booking creation and appointment)
        lead_time_result = await session.execute(
            select(
                func.avg(
                    func.extract(
                        'epoch',
                        Booking.appointment_start - Booking.created_at
                    ) / 3600
                ).label("avg_lead_time_hours")
            )
            .where(and_(*query_conditions))
        )
        avg_lead_time_hours = lead_time_result.scalar() or 0

        # Peak booking hours
        peak_hours_result = await session.execute(
            select(
                func.extract('hour', Booking.appointment_start).label("hour"),
                func.count(Booking.id).label("count")
            )
            .where(and_(*query_conditions))
            .group_by(func.extract('hour', Booking.appointment_start))
            .order_by(desc("count"))
        )

        peak_hours = [
            {"hour": int(row[0]), "bookings": row[1]}
            for row in peak_hours_result
        ]

        # Weekly patterns
        weekly_pattern_result = await session.execute(
            select(
                func.extract('dow', Booking.appointment_start).label("day_of_week"),
                func.count(Booking.id).label("count")
            )
            .where(and_(*query_conditions))
            .group_by(func.extract('dow', Booking.appointment_start))
            .order_by("day_of_week")
        )

        # Convert day of week to names (0=Sunday, 1=Monday, etc.)
        day_names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        weekly_pattern = [
            {"day": day_names[int(row[0])], "bookings": row[1]}
            for row in weekly_pattern_result
        ]

        return {
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            "total_bookings": total_bookings,
            "status_distribution": status_distribution,
            "no_show_rate": round(no_show_rate, 2),
            "cancellation_rate": round(cancellation_rate, 2),
            "average_lead_time_hours": round(avg_lead_time_hours, 2),
            "peak_booking_hours": peak_hours[:5],  # Top 5
            "weekly_booking_pattern": weekly_pattern
        }

    async def get_schedule_utilization(
        self,
        loctician_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        session: AsyncSession = None
    ) -> Dict[str, Any]:
        """
        Get schedule utilization analytics for a loctician.

        Args:
            loctician_id: Loctician ID
            start_date: Start date for analysis
            end_date: End date for analysis
            session: Database session

        Returns:
            Schedule utilization metrics
        """
        if session is None:
            async with get_db_session() as session:
                return await self.get_schedule_utilization(
                    loctician_id, start_date, end_date, session
                )

        # Default to last 7 days
        if not end_date:
            end_date = datetime.utcnow()
        if not start_date:
            start_date = end_date - timedelta(days=7)

        # Get booked hours
        booked_hours_result = await session.execute(
            select(
                func.sum(Booking.duration_minutes).label("total_minutes")
            )
            .where(
                and_(
                    Booking.loctician_id == loctician_id,
                    Booking.appointment_start >= start_date,
                    Booking.appointment_start <= end_date,
                    Booking.status.in_([
                        BookingStatus.CONFIRMED,
                        BookingStatus.COMPLETED,
                        BookingStatus.IN_PROGRESS
                    ])
                )
            )
        )

        total_booked_minutes = booked_hours_result.scalar() or 0
        total_booked_hours = total_booked_minutes / 60

        # Calculate available hours (assuming 8-hour work days, 5 days a week)
        work_days = (end_date - start_date).days
        # Approximate work days (excluding weekends)
        estimated_work_days = work_days * 5 / 7
        available_hours = estimated_work_days * 8

        # Calculate utilization rate
        utilization_rate = (
            (total_booked_hours / available_hours * 100)
            if available_hours > 0 else 0
        )

        # Daily breakdown
        daily_result = await session.execute(
            select(
                func.date(Booking.appointment_start).label("date"),
                func.sum(Booking.duration_minutes).label("booked_minutes"),
                func.count(Booking.id).label("bookings_count")
            )
            .where(
                and_(
                    Booking.loctician_id == loctician_id,
                    Booking.appointment_start >= start_date,
                    Booking.appointment_start <= end_date,
                    Booking.status.in_([
                        BookingStatus.CONFIRMED,
                        BookingStatus.COMPLETED,
                        BookingStatus.IN_PROGRESS
                    ])
                )
            )
            .group_by(func.date(Booking.appointment_start))
            .order_by(func.date(Booking.appointment_start))
        )

        daily_utilization = []
        for row in daily_result:
            daily_hours = (row.booked_minutes or 0) / 60
            daily_utilization_rate = (daily_hours / 8 * 100)  # Assuming 8-hour work day

            daily_utilization.append({
                "date": row.date.isoformat(),
                "booked_hours": round(daily_hours, 2),
                "bookings_count": row.bookings_count,
                "utilization_rate": round(daily_utilization_rate, 2)
            })

        return {
            "loctician_id": loctician_id,
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "days": work_days
            },
            "total_booked_hours": round(total_booked_hours, 2),
            "estimated_available_hours": round(available_hours, 2),
            "utilization_rate": round(utilization_rate, 2),
            "daily_utilization": daily_utilization
        }

    # Dashboard and Export Functions
    async def get_dashboard_summary(
        self,
        loctician_id: Optional[str] = None,
        session: AsyncSession = None
    ) -> Dict[str, Any]:
        """
        Get comprehensive dashboard summary.

        Args:
            loctician_id: Optional loctician filter
            session: Database session

        Returns:
            Dashboard summary data
        """
        if session is None:
            async with get_db_session() as session:
                return await self.get_dashboard_summary(loctician_id, session)

        today = datetime.utcnow().date()
        this_month_start = datetime(today.year, today.month, 1)
        last_month_start = (this_month_start - timedelta(days=1)).replace(day=1)

        # Get all metrics in parallel
        revenue_overview = await self.get_revenue_overview(
            start_date=this_month_start,
            loctician_id=loctician_id,
            session=session
        )

        booking_analytics = await self.get_booking_analytics(
            start_date=this_month_start,
            loctician_id=loctician_id,
            session=session
        )

        customer_insights = await self.get_customer_insights(
            start_date=this_month_start,
            session=session
        )

        # Today's bookings
        today_query_conditions = [
            func.date(Booking.appointment_start) == today,
            Booking.status != BookingStatus.CANCELLED
        ]

        if loctician_id:
            today_query_conditions.append(Booking.loctician_id == loctician_id)

        today_bookings_result = await session.execute(
            select(func.count(Booking.id))
            .where(and_(*today_query_conditions))
        )
        today_bookings = today_bookings_result.scalar() or 0

        # This week's revenue
        week_start = today - timedelta(days=today.weekday())
        week_revenue_result = await session.execute(
            select(func.sum(Booking.total_amount))
            .where(
                and_(
                    Booking.appointment_start >= week_start,
                    Booking.status.in_([BookingStatus.COMPLETED, BookingStatus.CONFIRMED]),
                    Booking.loctician_id == loctician_id if loctician_id else True
                )
            )
        )
        week_revenue = float(week_revenue_result.scalar() or 0)

        return {
            "period": "current_month",
            "today_bookings": today_bookings,
            "week_revenue": week_revenue,
            "month_revenue": revenue_overview["total_revenue"],
            "month_bookings": revenue_overview["bookings_count"],
            "average_booking_value": revenue_overview["average_booking_value"],
            "no_show_rate": booking_analytics["no_show_rate"],
            "cancellation_rate": booking_analytics["cancellation_rate"],
            "active_customers": customer_insights["active_customers"],
            "new_customers": customer_insights["new_customers"],
            "revenue_trends": revenue_overview["daily_trends"][-7:],  # Last 7 days
            "popular_services": await self.get_service_performance(
                start_date=this_month_start,
                loctician_id=loctician_id,
                session=session
            )[:5]  # Top 5 services
        }

    async def export_analytics_data(
        self,
        report_type: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        format: str = "csv",
        loctician_id: Optional[str] = None,
        session: AsyncSession = None
    ) -> Tuple[str, str]:  # Returns (data, filename)
        """
        Export analytics data to various formats.

        Args:
            report_type: Type of report (revenue, bookings, customers)
            start_date: Start date for report
            end_date: End date for report
            format: Export format (csv, json)
            loctician_id: Optional loctician filter
            session: Database session

        Returns:
            Tuple of (data_string, filename)
        """
        if session is None:
            async with get_db_session() as session:
                return await self.export_analytics_data(
                    report_type, start_date, end_date, format, loctician_id, session
                )

        # Default date range
        if not end_date:
            end_date = datetime.utcnow()
        if not start_date:
            start_date = end_date - timedelta(days=30)

        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = f"{report_type}_report_{timestamp}.{format}"

        if report_type == "revenue":
            data = await self.get_revenue_overview(start_date, end_date, loctician_id, session)
        elif report_type == "bookings":
            data = await self.get_booking_analytics(start_date, end_date, loctician_id, session)
        elif report_type == "customers":
            data = await self.get_customer_insights(start_date, end_date, session)
        elif report_type == "services":
            data = await self.get_service_performance(start_date, end_date, loctician_id, session)
        else:
            raise ValueError(f"Unknown report type: {report_type}")

        if format == "csv":
            # Convert to CSV
            output = io.StringIO()
            if report_type in ["revenue", "bookings", "customers"]:
                # Flat dictionary structure
                writer = csv.writer(output)
                writer.writerow(["Metric", "Value"])
                for key, value in data.items():
                    if not isinstance(value, (dict, list)):
                        writer.writerow([key, value])
            elif report_type == "services":
                # List of dictionaries
                if data:
                    writer = csv.DictWriter(output, fieldnames=data[0].keys())
                    writer.writeheader()
                    writer.writerows(data)

            return output.getvalue(), filename

        else:  # JSON format
            import json
            return json.dumps(data, indent=2, default=str), filename


# Create service instance
analytics_service = AnalyticsService()