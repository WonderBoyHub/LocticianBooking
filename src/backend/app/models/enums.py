"""
Database enums for the Loctician Booking System.
"""
import enum


class UserRole(str, enum.Enum):
    """User role enumeration."""

    CUSTOMER = "customer"
    LOCTICIAN = "loctician"
    ADMIN = "admin"
    STAFF = "staff"


class UserStatus(str, enum.Enum):
    """User status enumeration."""

    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    DELETED = "deleted"


class BookingStatus(str, enum.Enum):
    """Booking status enumeration."""

    PENDING = "pending"
    CONFIRMED = "confirmed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class PaymentStatus(str, enum.Enum):
    """Payment status enumeration."""

    PENDING = "pending"
    PARTIAL = "partial"
    PAID = "paid"
    REFUNDED = "refunded"
    FAILED = "failed"


class CalendarEventType(str, enum.Enum):
    """Calendar event type enumeration."""

    BREAK = "break"
    MEETING = "meeting"
    VACATION = "vacation"
    SICK_LEAVE = "sick_leave"
    TRAINING = "training"
    PERSONAL = "personal"


class PageType(str, enum.Enum):
    """CMS page type enumeration."""

    PAGE = "page"
    BLOG_POST = "blog_post"
    SERVICE_PAGE = "service_page"
    PRODUCT_PAGE = "product_page"
    LANDING_PAGE = "landing_page"


class TemplateType(str, enum.Enum):
    """Email template type enumeration - matches Neon DB templatetype enum."""

    BOOKING_CONFIRMATION = "BOOKING_CONFIRMATION"
    REMINDER = "REMINDER"
    CANCELLATION = "CANCELLATION"
    WELCOME = "WELCOME"
    PASSWORD_RESET = "PASSWORD_RESET"
    MARKETING = "MARKETING"
    INVOICE = "INVOICE"


class EmailStatus(str, enum.Enum):
    """Email status enumeration."""

    QUEUED = "queued"
    SENDING = "sending"
    SENT = "sent"
    FAILED = "failed"
    BOUNCED = "bounced"
