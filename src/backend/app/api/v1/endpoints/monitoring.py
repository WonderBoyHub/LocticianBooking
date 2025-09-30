"""Comprehensive monitoring and logging endpoints with graceful psutil fallbacks."""
import os
import shutil
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_admin, require_staff
from app.core.database import get_db
from app.core.redis_client import flush_upstash_database
from app.models.user import User

logger = structlog.get_logger(__name__)

try:  # pragma: no cover - import guard for environments missing native psutil wheels
    import psutil  # type: ignore
except Exception as exc:  # pylint: disable=broad-except
    logger.warning(
        "psutil unavailable; system metrics will be degraded",
        error=str(exc),
    )
    psutil = None  # type: ignore

router = APIRouter()


class SystemMetrics:
    """System metrics model."""

    def __init__(self):
        self.timestamp = datetime.utcnow()
        self.cpu_percent = None
        self.cpu_count = os.cpu_count()
        self.cpu_count_logical = self.cpu_count
        self.memory = None
        self.disk = None
        self.network = None
        self.boot_time: Optional[datetime] = None

        if psutil:  # type: ignore[truthy-bool]
            try:
                self.cpu_percent = psutil.cpu_percent(interval=1)
            except Exception as exc:  # pragma: no cover - defensive logging
                logger.debug("psutil cpu_percent failed", error=str(exc))
            try:
                self.cpu_count = psutil.cpu_count()
                self.cpu_count_logical = psutil.cpu_count(logical=True)
            except Exception as exc:
                logger.debug("psutil cpu_count failed", error=str(exc))
            try:
                self.memory = psutil.virtual_memory()
            except Exception as exc:
                logger.debug("psutil virtual_memory failed", error=str(exc))
            try:
                self.disk = psutil.disk_usage('/')
            except Exception as exc:
                logger.debug("psutil disk_usage failed", error=str(exc))
            try:
                self.network = psutil.net_io_counters()
            except Exception as exc:
                logger.debug("psutil net_io_counters failed", error=str(exc))
            try:
                self.boot_time = datetime.fromtimestamp(psutil.boot_time())
            except Exception as exc:
                logger.debug("psutil boot_time failed", error=str(exc))

        if self.memory is None:
            # Provide minimal memory info using os module fallbacks
            try:
                page_size = os.sysconf("SC_PAGE_SIZE")
                phys_pages = os.sysconf("SC_PHYS_PAGES")
                total = page_size * phys_pages
                self.memory = {
                    "total": total,
                    "available": None,
                    "percent": None,
                    "used": None,
                    "free": None,
                }
            except (ValueError, OSError, AttributeError):
                self.memory = {
                    "total": None,
                    "available": None,
                    "percent": None,
                    "used": None,
                    "free": None,
                }

        if self.disk is None:
            try:
                usage = shutil.disk_usage('/')
                self.disk = {
                    "total": usage.total,
                    "used": usage.used,
                    "free": usage.free,
                }
            except (FileNotFoundError, PermissionError, OSError):
                self.disk = {
                    "total": None,
                    "used": None,
                    "free": None,
                }

        if self.network is None:
            self.network = {
                "bytes_sent": None,
                "bytes_recv": None,
                "packets_sent": None,
                "packets_recv": None,
            }

        if self.boot_time is None:
            self.boot_time = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat(),
            "cpu": {
                "percent": self.cpu_percent,
                "count": self.cpu_count,
                "count_logical": self.cpu_count_logical,
            },
            "memory": {
                "total": getattr(self.memory, "total", None) if hasattr(self.memory, "total") else self.memory.get("total"),
                "available": getattr(self.memory, "available", None) if hasattr(self.memory, "available") else self.memory.get("available"),
                "percent": getattr(self.memory, "percent", None) if hasattr(self.memory, "percent") else self.memory.get("percent"),
                "used": getattr(self.memory, "used", None) if hasattr(self.memory, "used") else self.memory.get("used"),
                "free": getattr(self.memory, "free", None) if hasattr(self.memory, "free") else self.memory.get("free"),
            },
            "disk": {
                "total": getattr(self.disk, "total", None) if hasattr(self.disk, "total") else self.disk.get("total"),
                "used": getattr(self.disk, "used", None) if hasattr(self.disk, "used") else self.disk.get("used"),
                "free": getattr(self.disk, "free", None) if hasattr(self.disk, "free") else self.disk.get("free"),
                "percent": self._compute_disk_percent(),
            },
            "network": {
                "bytes_sent": getattr(self.network, "bytes_sent", None) if hasattr(self.network, "bytes_sent") else self.network.get("bytes_sent"),
                "bytes_recv": getattr(self.network, "bytes_recv", None) if hasattr(self.network, "bytes_recv") else self.network.get("bytes_recv"),
                "packets_sent": getattr(self.network, "packets_sent", None) if hasattr(self.network, "packets_sent") else self.network.get("packets_sent"),
                "packets_recv": getattr(self.network, "packets_recv", None) if hasattr(self.network, "packets_recv") else self.network.get("packets_recv"),
            },
            "uptime_seconds": (datetime.utcnow() - self.boot_time).total_seconds() if self.boot_time else None,
        }

    def _compute_disk_percent(self) -> Optional[float]:
        total = getattr(self.disk, "total", None) if hasattr(self.disk, "total") else self.disk.get("total")
        used = getattr(self.disk, "used", None) if hasattr(self.disk, "used") else self.disk.get("used")
        if total in (None, 0) or used is None:
            return None
        return (used / total) * 100


class DatabaseMetrics:
    """Database metrics model."""

    def __init__(self, db_stats: Dict[str, Any]):
        self.db_stats = db_stats
        self.timestamp = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat(),
            "connections": {
                "active": self.db_stats.get("active_connections", 0),
                "idle": self.db_stats.get("idle_connections", 0),
                "total": self.db_stats.get("total_connections", 0)
            },
            "tables": self.db_stats.get("table_stats", {}),
            "performance": {
                "avg_query_time_ms": self.db_stats.get("avg_query_time", 0),
                "slow_queries": self.db_stats.get("slow_queries", 0),
                "cache_hit_ratio": self.db_stats.get("cache_hit_ratio", 0)
            }
        }


class ApplicationMetrics:
    """Application-specific metrics model."""

    def __init__(self, app_stats: Dict[str, Any]):
        self.app_stats = app_stats
        self.timestamp = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat(),
            "users": {
                "total": self.app_stats.get("total_users", 0),
                "active_today": self.app_stats.get("active_users_today", 0),
                "new_today": self.app_stats.get("new_users_today", 0)
            },
            "bookings": {
                "total": self.app_stats.get("total_bookings", 0),
                "today": self.app_stats.get("bookings_today", 0),
                "pending": self.app_stats.get("pending_bookings", 0),
                "confirmed": self.app_stats.get("confirmed_bookings", 0)
            },
            "revenue": {
                "total": float(self.app_stats.get("total_revenue", 0)),
                "today": float(self.app_stats.get("revenue_today", 0)),
                "this_month": float(self.app_stats.get("revenue_this_month", 0))
            },
            "errors": {
                "last_24h": self.app_stats.get("errors_24h", 0),
                "last_hour": self.app_stats.get("errors_1h", 0)
            }
        }


# System Health Endpoints
@router.get("/health/system")
async def get_system_health(
    current_user: User = Depends(require_admin),
) -> Dict[str, Any]:
    """Get comprehensive system health metrics (admin only)."""
    try:
        metrics = SystemMetrics()
        return {
            "status": "healthy",
            "metrics": metrics.to_dict()
        }
    except Exception as e:
        logger.error("System health check failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="System health check failed"
        )


@router.get("/health/database")
async def get_database_health(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Get database health metrics (admin only)."""
    try:
        # Get database statistics
        db_stats_query = await db.execute(text("""
            WITH connection_stats AS (
                SELECT
                    count(*) FILTER (WHERE state = 'active') as active_connections,
                    count(*) FILTER (WHERE state = 'idle') as idle_connections,
                    count(*) as total_connections
                FROM pg_stat_activity
                WHERE datname = current_database()
            ),
            table_stats AS (
                SELECT
                    schemaname,
                    tablename,
                    n_tup_ins as inserts,
                    n_tup_upd as updates,
                    n_tup_del as deletes,
                    seq_scan + idx_scan as total_scans
                FROM pg_stat_user_tables
                ORDER BY total_scans DESC
                LIMIT 10
            ),
            performance_stats AS (
                SELECT
                    COALESCE(avg(mean_exec_time), 0) as avg_query_time,
                    count(*) FILTER (WHERE mean_exec_time > 1000) as slow_queries
                FROM pg_stat_statements
                WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
            ),
            cache_stats AS (
                SELECT
                    sum(blks_hit) * 100.0 / NULLIF(sum(blks_hit) + sum(blks_read), 0) as cache_hit_ratio
                FROM pg_stat_database
                WHERE datname = current_database()
            )
            SELECT
                cs.active_connections,
                cs.idle_connections,
                cs.total_connections,
                ps.avg_query_time,
                ps.slow_queries,
                COALESCE(cache_s.cache_hit_ratio, 0) as cache_hit_ratio,
                array_agg(
                    json_build_object(
                        'table', ts.tablename,
                        'inserts', ts.inserts,
                        'updates', ts.updates,
                        'deletes', ts.deletes,
                        'scans', ts.total_scans
                    )
                ) as table_stats
            FROM connection_stats cs
            CROSS JOIN performance_stats ps
            CROSS JOIN cache_stats cache_s
            LEFT JOIN table_stats ts ON true
            GROUP BY cs.active_connections, cs.idle_connections, cs.total_connections,
                     ps.avg_query_time, ps.slow_queries, cache_s.cache_hit_ratio
        """))

        db_stats_row = db_stats_query.first()

        db_stats = {
            "active_connections": db_stats_row.active_connections or 0,
            "idle_connections": db_stats_row.idle_connections or 0,
            "total_connections": db_stats_row.total_connections or 0,
            "avg_query_time": float(db_stats_row.avg_query_time or 0),
            "slow_queries": db_stats_row.slow_queries or 0,
            "cache_hit_ratio": float(db_stats_row.cache_hit_ratio or 0),
            "table_stats": db_stats_row.table_stats or []
        }

        metrics = DatabaseMetrics(db_stats)

        return {
            "status": "healthy",
            "metrics": metrics.to_dict()
        }

    except Exception as e:
        logger.error("Database health check failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database health check failed"
        )


@router.get("/health/application")
async def get_application_health(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Get application health metrics (admin only)."""
    try:
        # Get application statistics
        app_stats_query = await db.execute(text("""
            WITH user_stats AS (
                SELECT
                    count(*) as total_users,
                    count(*) FILTER (WHERE last_login_at >= NOW() - INTERVAL '1 day') as active_users_today,
                    count(*) FILTER (WHERE created_at >= CURRENT_DATE) as new_users_today
                FROM users
                WHERE is_deleted = false
            ),
            booking_stats AS (
                SELECT
                    count(*) as total_bookings,
                    count(*) FILTER (WHERE created_at >= CURRENT_DATE) as bookings_today,
                    count(*) FILTER (WHERE status = 'pending') as pending_bookings,
                    count(*) FILTER (WHERE status = 'confirmed') as confirmed_bookings
                FROM bookings
            ),
            revenue_stats AS (
                SELECT
                    COALESCE(sum(total_amount) FILTER (WHERE status = 'completed'), 0) as total_revenue,
                    COALESCE(sum(total_amount) FILTER (WHERE status = 'completed' AND created_at >= CURRENT_DATE), 0) as revenue_today,
                    COALESCE(sum(total_amount) FILTER (WHERE status = 'completed' AND created_at >= DATE_TRUNC('month', NOW())), 0) as revenue_this_month
                FROM bookings
            ),
            error_stats AS (
                SELECT
                    0 as errors_24h,  -- Would be from error logging table if implemented
                    0 as errors_1h
            )
            SELECT
                us.total_users,
                us.active_users_today,
                us.new_users_today,
                bs.total_bookings,
                bs.bookings_today,
                bs.pending_bookings,
                bs.confirmed_bookings,
                rs.total_revenue,
                rs.revenue_today,
                rs.revenue_this_month,
                es.errors_24h,
                es.errors_1h
            FROM user_stats us
            CROSS JOIN booking_stats bs
            CROSS JOIN revenue_stats rs
            CROSS JOIN error_stats es
        """))

        app_stats_row = app_stats_query.first()

        app_stats = {
            "total_users": app_stats_row.total_users,
            "active_users_today": app_stats_row.active_users_today,
            "new_users_today": app_stats_row.new_users_today,
            "total_bookings": app_stats_row.total_bookings,
            "bookings_today": app_stats_row.bookings_today,
            "pending_bookings": app_stats_row.pending_bookings,
            "confirmed_bookings": app_stats_row.confirmed_bookings,
            "total_revenue": app_stats_row.total_revenue,
            "revenue_today": app_stats_row.revenue_today,
            "revenue_this_month": app_stats_row.revenue_this_month,
            "errors_24h": app_stats_row.errors_24h,
            "errors_1h": app_stats_row.errors_1h
        }

        metrics = ApplicationMetrics(app_stats)

        return {
            "status": "healthy",
            "metrics": metrics.to_dict()
        }

    except Exception as e:
        logger.error("Application health check failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Application health check failed"
        )


# Performance Monitoring
@router.get("/performance/slow-queries")
async def get_slow_queries(
    limit: int = Query(10, le=50, description="Number of queries to return"),
    min_duration_ms: float = Query(1000, description="Minimum query duration in milliseconds"),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Get slow queries (admin only)."""
    try:
        slow_queries_query = await db.execute(text("""
            SELECT
                query,
                calls,
                total_exec_time,
                mean_exec_time,
                max_exec_time,
                rows,
                100.0 * shared_blks_hit / NULLIF(shared_blks_hit + shared_blks_read, 0) AS hit_percent
            FROM pg_stat_statements
            WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
            AND mean_exec_time > :min_duration
            ORDER BY mean_exec_time DESC
            LIMIT :limit
        """), {"min_duration": min_duration_ms, "limit": limit})

        queries = []
        for row in slow_queries_query.fetchall():
            queries.append({
                "query": row.query,
                "calls": row.calls,
                "total_exec_time_ms": float(row.total_exec_time),
                "mean_exec_time_ms": float(row.mean_exec_time),
                "max_exec_time_ms": float(row.max_exec_time),
                "rows": row.rows,
                "cache_hit_percent": float(row.hit_percent or 0)
            })

        return queries

    except Exception as e:
        logger.error("Get slow queries failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get slow queries"
        )


@router.get("/performance/table-sizes")
async def get_table_sizes(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Get table sizes and usage statistics (admin only)."""
    try:
        table_sizes_query = await db.execute(text("""
            SELECT
                schemaname,
                tablename,
                pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
                pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes,
                n_tup_ins AS inserts,
                n_tup_upd AS updates,
                n_tup_del AS deletes,
                n_live_tup AS live_tuples,
                n_dead_tup AS dead_tuples,
                last_vacuum,
                last_autovacuum,
                last_analyze,
                last_autoanalyze
            FROM pg_stat_user_tables
            ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        """))

        tables = []
        for row in table_sizes_query.fetchall():
            tables.append({
                "schema": row.schemaname,
                "table": row.tablename,
                "size": row.size,
                "size_bytes": row.size_bytes,
                "inserts": row.inserts,
                "updates": row.updates,
                "deletes": row.deletes,
                "live_tuples": row.live_tuples,
                "dead_tuples": row.dead_tuples,
                "last_vacuum": row.last_vacuum.isoformat() if row.last_vacuum else None,
                "last_autovacuum": row.last_autovacuum.isoformat() if row.last_autovacuum else None,
                "last_analyze": row.last_analyze.isoformat() if row.last_analyze else None,
                "last_autoanalyze": row.last_autoanalyze.isoformat() if row.last_autoanalyze else None
            })

        return tables

    except Exception as e:
        logger.error("Get table sizes failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get table sizes"
        )


# Audit Logs
@router.get("/audit/user-actions")
async def get_user_audit_logs(
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    action: Optional[str] = Query(None, description="Filter by action type"),
    start_date: Optional[datetime] = Query(None, description="Start date filter"),
    end_date: Optional[datetime] = Query(None, description="End date filter"),
    limit: int = Query(100, le=1000, description="Limit results"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    current_user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Get user audit logs (staff/admin only)."""
    try:
        # Build dynamic query
        conditions = ["1=1"]
        params = {"limit": limit, "offset": offset}

        if user_id:
            conditions.append("user_id = :user_id::uuid")
            params["user_id"] = user_id

        if action:
            conditions.append("action ILIKE :action")
            params["action"] = f"%{action}%"

        if start_date:
            conditions.append("created_at >= :start_date")
            params["start_date"] = start_date

        if end_date:
            conditions.append("created_at <= :end_date")
            params["end_date"] = end_date

        where_clause = " AND ".join(conditions)

        audit_query = await db.execute(text(f"""
            SELECT
                al.id,
                al.user_id,
                u.email as user_email,
                CONCAT(u.first_name, ' ', u.last_name) as user_name,
                al.action,
                al.resource_type,
                al.resource_id,
                al.details,
                al.ip_address,
                al.user_agent,
                al.created_at
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE {where_clause}
            ORDER BY al.created_at DESC
            LIMIT :limit OFFSET :offset
        """), params)

        logs = []
        for row in audit_query.fetchall():
            logs.append({
                "id": row.id,
                "user_id": row.user_id,
                "user_email": row.user_email,
                "user_name": row.user_name,
                "action": row.action,
                "resource_type": row.resource_type,
                "resource_id": row.resource_id,
                "details": row.details,
                "ip_address": row.ip_address,
                "user_agent": row.user_agent,
                "created_at": row.created_at.isoformat()
            })

        return logs

    except Exception as e:
        logger.error("Get audit logs failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get audit logs"
        )


# Security Monitoring
@router.get("/security/failed-logins")
async def get_failed_login_attempts(
    hours: int = Query(24, le=168, description="Hours to look back"),
    limit: int = Query(100, le=1000, description="Limit results"),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Get failed login attempts (admin only)."""
    try:
        failed_logins_query = await db.execute(text("""
            SELECT
                email,
                ip_address,
                user_agent,
                failure_reason,
                attempted_at,
                count(*) as attempt_count
            FROM failed_login_attempts
            WHERE attempted_at >= NOW() - INTERVAL ':hours hours'
            GROUP BY email, ip_address, user_agent, failure_reason, attempted_at
            ORDER BY attempted_at DESC
            LIMIT :limit
        """), {"hours": hours, "limit": limit})

        attempts = []
        for row in failed_logins_query.fetchall():
            attempts.append({
                "email": row.email,
                "ip_address": row.ip_address,
                "user_agent": row.user_agent,
                "failure_reason": row.failure_reason,
                "attempted_at": row.attempted_at.isoformat(),
                "attempt_count": row.attempt_count
            })

        return attempts

    except Exception as e:
        logger.error("Get failed logins failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get failed login attempts"
        )


@router.get("/security/rate-limit-violations")
async def get_rate_limit_violations(
    hours: int = Query(24, le=168, description="Hours to look back"),
    limit: int = Query(100, le=1000, description="Limit results"),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Get rate limit violations (admin only)."""
    try:
        violations_query = await db.execute(text("""
            SELECT
                ip_address,
                endpoint,
                user_id,
                violation_count,
                first_violation_at,
                last_violation_at
            FROM rate_limit_violations
            WHERE first_violation_at >= NOW() - INTERVAL ':hours hours'
            ORDER BY last_violation_at DESC
            LIMIT :limit
        """), {"hours": hours, "limit": limit})

        violations = []
        for row in violations_query.fetchall():
            violations.append({
                "ip_address": row.ip_address,
                "endpoint": row.endpoint,
                "user_id": row.user_id,
                "violation_count": row.violation_count,
                "first_violation_at": row.first_violation_at.isoformat(),
                "last_violation_at": row.last_violation_at.isoformat()
            })

        return violations

    except Exception as e:
        logger.error("Get rate limit violations failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get rate limit violations"
        )


# System Maintenance
@router.post("/maintenance/clear-cache")
async def clear_application_cache(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, str]:
    """Clear application cache (admin only)."""
    try:
        # Clear Redis cache if configured
        flushed = await flush_upstash_database()
        if flushed:
            logger.info("Upstash Redis cache flushed", cleared_by=current_user.id)
        elif flushed is False:
            logger.warning("Upstash Redis cache flush failed", cleared_by=current_user.id)

        # Clear database query cache
        await db.execute(text("SELECT pg_stat_reset()"))
        await db.execute(text("SELECT pg_stat_statements_reset()"))

        await db.commit()

        logger.info("Application cache cleared", cleared_by=current_user.id)

        return {"status": "Cache cleared successfully"}

    except Exception as e:
        logger.error("Clear cache failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to clear cache"
        )


@router.post("/maintenance/vacuum-analyze")
async def vacuum_analyze_database(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, str]:
    """Run VACUUM ANALYZE on database (admin only)."""
    try:
        # Note: VACUUM cannot be run inside a transaction
        await db.execute(text("VACUUM ANALYZE"))

        logger.info("Database vacuum analyze completed", initiated_by=current_user.id)

        return {"status": "VACUUM ANALYZE completed successfully"}

    except Exception as e:
        logger.error("Vacuum analyze failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to run VACUUM ANALYZE"
        )
