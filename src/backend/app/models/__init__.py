"""Database models for the Loctician Booking System."""

from app.models.user import User, UserProfile
from app.models.service import Service, ServiceCategory
from app.models.product import Product, ProductCategory
from app.models.booking import Booking, BookingService, BookingProduct, BookingStateChange
from app.models.availability import AvailabilityPattern, AvailabilityOverride
from app.models.calendar_event import CalendarEvent
from app.models.audit import AuditLog
from app.models.email_template import EmailTemplate, EmailQueue
from app.models.cms import CMSContentSettings, CMSPage
from app.models.media import MediaFile
from app.models.instagram import InstagramPost

__all__ = [
    "User",
    "UserProfile",
    "Service",
    "ServiceCategory",
    "Product",
    "ProductCategory",
    "Booking",
    "BookingService",
    "BookingProduct",
    "BookingStateChange",
    "AvailabilityPattern",
    "AvailabilityOverride",
    "CalendarEvent",
    "AuditLog",
    "EmailTemplate",
    "EmailQueue",
    "CMSPage",
    "CMSContentSettings",
    "MediaFile",
    "InstagramPost",
]