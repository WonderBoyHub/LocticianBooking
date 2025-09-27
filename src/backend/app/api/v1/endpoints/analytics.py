"""Simple analytics for loctician business."""
from datetime import date, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.auth.dependencies import get_current_active_user
from app.models.user import User

router = APIRouter()

@router.get("/dashboard")
async def dashboard_stats(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Basic dashboard stats."""
    today = date.today()
    week_ago = today - timedelta(days=7)

    # Today's bookings
    today_result = await db.execute(text("""
        SELECT COUNT(*) as bookings, COALESCE(SUM(total_amount), 0) as revenue
        FROM bookings WHERE DATE(appointment_start) = :today AND status != 'cancelled'
    """), {"today": today})

    # Week's bookings
    week_result = await db.execute(text("""
        SELECT COUNT(*) as bookings, COALESCE(SUM(total_amount), 0) as revenue
        FROM bookings WHERE DATE(appointment_start) >= :week_ago AND status != 'cancelled'
    """), {"week_ago": week_ago})

    today_stats = today_result.fetchone()
    week_stats = week_result.fetchone()

    return {
        "today": {"bookings": today_stats.bookings, "revenue": float(today_stats.revenue)},
        "this_week": {"bookings": week_stats.bookings, "revenue": float(week_stats.revenue)}
    }

@router.get("/popular-services")
async def popular_services(
    days: int = Query(30),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Most popular services."""
    result = await db.execute(text("""
        SELECT s.name, COUNT(*) as bookings
        FROM bookings b JOIN services s ON b.service_id = s.id
        WHERE DATE(b.appointment_start) >= :since_date AND b.status != 'cancelled'
        GROUP BY s.name ORDER BY bookings DESC LIMIT 5
    """), {"since_date": date.today() - timedelta(days=days)})

    return [{"service": r.name, "bookings": r.bookings} for r in result.fetchall()]