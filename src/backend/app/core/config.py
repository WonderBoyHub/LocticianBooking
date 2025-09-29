"""Configuration settings for the Loctician Booking System API."""
from functools import lru_cache
from pathlib import Path
from typing import List, Optional, Union

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""

    # API Configuration
    API_V1_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "Loctician Booking API"
    PROJECT_VERSION: str = "1.0.0"
    DESCRIPTION: str = "Comprehensive booking system for locticians"

    # Database
    DATABASE_URL: str = Field(..., description="PostgreSQL database URL")
    DATABASE_TEST_URL: Optional[str] = None
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 0
    DB_POOL_RECYCLE: int = 300

    # Redis
    REDIS_URL: str = Field(default="redis://localhost:6379/0")

    # Security
    SECRET_KEY: str = Field(..., min_length=32, description="Secret key for JWT tokens")
    ALGORITHM: str = "HS256"
    JWT_PRIVATE_KEY: Optional[str] = Field(
        default=None,
        description="PEM encoded private key used for signing JWTs",
    )
    JWT_PUBLIC_KEY: Optional[str] = Field(
        default=None,
        description="PEM encoded public key exposed via JWKS",
    )
    JWT_KEY_ID: Optional[str] = Field(
        default="loctician-booking-key",
        description="Key identifier included in JWT headers and JWKS documents",
    )
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    SESSION_SECURE_COOKIES: bool = False
    SESSION_HTTPONLY_COOKIES: bool = True
    SESSION_SAMESITE: str = "lax"
    CSRF_PROTECTION_ENABLED: bool = True

    # CORS
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

    @field_validator("JWT_PRIVATE_KEY", "JWT_PUBLIC_KEY", mode="before")
    @classmethod
    def load_key_material(cls, value: Optional[str]):
        """Allow providing PEM material directly or via file path."""
        if not value:
            return value

        value = str(value).strip()

        if not value:
            return None

        # Replace escaped newlines to support .env storage
        normalized_value = value.replace("\\n", "\n")

        if "-----BEGIN" in normalized_value:
            return normalized_value

        potential_path = Path(normalized_value)
        if potential_path.exists():
            return potential_path.read_text().strip()

        return normalized_value

    @property
    def jwt_algorithm(self) -> str:
        """Return the effective JWT signing algorithm."""
        if self.JWT_PRIVATE_KEY:
            return "RS256"
        return self.ALGORITHM or "HS256"

    # Email Configuration
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM: Optional[str] = None
    SMTP_FROM_NAME: str = "Loctician Booking"

    # File Upload
    MAX_FILE_SIZE_MB: int = 10
    UPLOAD_PATH: str = "./uploads"
    ALLOWED_EXTENSIONS: List[str] = ["jpg", "jpeg", "png", "gif", "pdf"]

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

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Create settings instance
settings = get_settings()
