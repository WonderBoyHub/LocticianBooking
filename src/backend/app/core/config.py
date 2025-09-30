"""Configuration settings for the Loctician Booking System API."""
from functools import lru_cache
from typing import List, Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings."""

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)

    # API Configuration
    API_V1_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "Loctician Booking API"
    PROJECT_VERSION: str = "1.0.0"
    DESCRIPTION: str = "Comprehensive booking system for locticians"

    # Database
    DATABASE_URL: str = Field(
        default="sqlite+aiosqlite:///./app.db",
        description="Database URL (defaults to local SQLite for development/tests)",
    )
    DATABASE_TEST_URL: Optional[str] = None
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 0
    DB_POOL_RECYCLE: int = 300

    # Redis
    REDIS_URL: str = Field(default="redis://localhost:6379/0")

    # Security
    SECRET_KEY: str = Field(
        default="dev-secret-key-change-me-please-0123456789",
        min_length=32,
        description="Secret key for JWT tokens",
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    JWT_JWKS_URL: Optional[str] = Field(
        default=None,
        description="Neon RLS JWKS endpoint for verifying external JWTs"
    )
    JWT_JWKS_CACHE_SECONDS: int = 300
    JWT_ALLOWED_ALGORITHMS: List[str] = Field(
        default_factory=lambda: ["RS256"],
        description="Accepted JWT signing algorithms when using JWKS"
    )
    JWT_AUDIENCE: Optional[str] = Field(
        default=None,
        description="Expected JWT audience when validating external tokens"
    )
    JWT_ISSUER: Optional[str] = Field(
        default=None,
        description="Expected JWT issuer when validating external tokens"
    )
    SESSION_SECURE_COOKIES: bool = False
    SESSION_HTTPONLY_COOKIES: bool = True
    SESSION_SAMESITE: str = "lax"
    CSRF_PROTECTION_ENABLED: bool = True

    # CORS
    FRONTEND_URL: str = "http://localhost:3001"
    BACKEND_CORS_ORIGINS: str = "http://localhost:3001"

    @property
    def cors_origins_list(self) -> List[str]:
        """Convert CORS origins string to list."""
        if isinstance(self.BACKEND_CORS_ORIGINS, str):
            if "," in self.BACKEND_CORS_ORIGINS:
                return [origin.strip() for origin in self.BACKEND_CORS_ORIGINS.split(",")]
            else:
                return [self.BACKEND_CORS_ORIGINS.strip()]
        return self.BACKEND_CORS_ORIGINS

    # Email Configuration
    SMTP_HOST: str = "smtp-relay.brevo.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM: Optional[str] = None
    SMTP_FROM_NAME: str = "Loctician Booking"
    SMTP_STARTTLS: bool = True
    SMTP_SSL: bool = False

    # File Upload
    MAX_FILE_SIZE_MB: int = 10
    UPLOAD_PATH: str = "./uploads"
    ALLOWED_EXTENSIONS: List[str] = [
        "jpg",
        "jpeg",
        "png",
        "gif",
        "webp",
        "pdf",
        "mp4",
        "mov",
        "webm",
        "mkv",
    ]

    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60
    RATE_LIMIT_BURST: int = 10
    RATE_LIMIT_BACKEND: str = "memory"

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"

    # Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    ENABLE_DOCS: bool = True
    SQL_ECHO: bool = False

    # Monitoring
    ENABLE_METRICS: bool = True
    METRICS_PORT: int = 9090
    ENABLE_HEALTH_CHECKS: bool = True

    # Instagram Integration
    INSTAGRAM_ACCESS_TOKEN: Optional[str] = None
    INSTAGRAM_BUSINESS_ACCOUNT_ID: Optional[str] = None
    ENABLE_INSTAGRAM: bool = False

    # Feature Flags
    ENABLE_SMS_NOTIFICATIONS: bool = False
    ENABLE_PAYMENTS: bool = False
    ENABLE_ANALYTICS: bool = False
    ENABLE_GDPR_FEATURES: bool = True

    # Mollie Payment Integration
    MOLLIE_API_KEY: Optional[str] = Field(None, description="Mollie API key (test or live)")
    MOLLIE_WEBHOOK_SECRET: Optional[str] = Field(None, description="Mollie webhook secret for signature verification")
    MOLLIE_TEST_MODE: bool = Field(True, description="Whether to use Mollie test mode")
    PAYMENT_PROVIDER_API_KEY: Optional[str] = None
    PAYMENT_PROVIDER_SECRET: Optional[str] = None
    SMS_PROVIDER_API_KEY: Optional[str] = None
    ANALYTICS_TRACKING_ID: Optional[str] = None

    # Timezone
    DEFAULT_TIMEZONE: str = "Europe/Copenhagen"

    # Business Rules
    DEFAULT_BOOKING_BUFFER_MINUTES: int = 15
    MAX_ADVANCE_BOOKING_DAYS: int = 90
    MIN_ADVANCE_BOOKING_HOURS: int = 24

    # Backup Configuration
    BACKUP_S3_BUCKET: Optional[str] = None
    BACKUP_S3_ACCESS_KEY: Optional[str] = None
    BACKUP_S3_SECRET_KEY: Optional[str] = None
    BACKUP_LOCAL_PATH: str = "./backups"

    # WebSocket
    WEBSOCKET_PING_INTERVAL: int = 20
    WEBSOCKET_PING_TIMEOUT: int = 10

@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Create settings instance
settings = get_settings()
