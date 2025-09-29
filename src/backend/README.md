# 🎯 Loctician Booking System - FastAPI Backend

A comprehensive, production-ready FastAPI backend for the Loctician Booking System with advanced security, real-time updates, and Danish compliance features.

## 🌟 Key Features

### 🔐 Advanced Security
- **PostgreSQL Security Functions**: Database-level authentication with JWT tokens
- **Row Level Security (RLS)**: Data isolation based on user roles
- **Rate Limiting**: API protection with PostgreSQL-backed rate limiting
- **Anti-Double-Booking**: Database constraints preventing booking conflicts
- **GDPR Compliance**: Built-in data export, anonymization, and retention

### 🚀 Modern Architecture
- **FastAPI with Async/Await**: High-performance async operations
- **SQLAlchemy 2.0**: Modern ORM with async support
- **Pydantic v2**: Advanced data validation and serialization
- **WebSocket Support**: Real-time updates for bookings and availability
- **Structured Logging**: JSON-formatted logs with structured data

### 🌐 Danish Business Features
- **Copenhagen Timezone**: Default Danish timezone handling
- **GDPR Compliance**: European data protection compliance
- **Danish Language Support**: Full-text search with Danish stemming
- **Currency Handling**: DKK currency formatting and validation

### 📊 Database Integration
- **PostgreSQL Functions**: Leverages advanced database features
- **Full-Text Search**: Multi-language search with ranking
- **Audit Trail**: Comprehensive activity logging
- **Automated Jobs**: Scheduled maintenance and cleanup

## 🏗️ Architecture Overview

```
src/backend/
├── main.py                 # FastAPI application entry point
├── start.py               # Production startup script
├── app/
│   ├── api/v1/endpoints/  # API route handlers
│   │   ├── auth.py        # Authentication endpoints
│   │   ├── bookings.py    # Booking management
│   │   ├── users.py       # User management
│   │   ├── services.py    # Service catalog
│   │   └── calendar.py    # Availability management
│   ├── auth/              # Authentication system
│   │   ├── auth.py        # JWT and password handling
│   │   └── dependencies.py # Auth dependencies
│   ├── core/              # Core application components
│   │   ├── config.py      # Configuration management
│   │   └── database.py    # Database connection
│   ├── models/            # SQLAlchemy models
│   ├── schemas/           # Pydantic schemas
│   ├── middleware/        # Custom middleware
│   ├── websocket/         # Real-time communication
│   ├── services/          # Business logic
│   ├── security/          # Security utilities
│   └── utils/             # Helper functions
├── tests/                 # Test suite
├── migrations/            # Database migrations
└── requirements.txt       # Dependencies
```

## 🚀 Quick Start

### Prerequisites

- Python 3.8+
- PostgreSQL 12+
- Redis 6+ (optional, for advanced caching)

### 1. Environment Setup

```bash
# Clone the repository
cd src/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\\Scripts\\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment configuration
cp .env.example .env
```

### 2. Database Setup

```bash
# Create PostgreSQL database
createdb loctician_booking

# Run the schema and security enhancements
psql loctician_booking < ../../schema.sql
psql loctician_booking < ../../security_enhancements.sql
```

### 3. Configure Environment

Edit `.env` file with your settings:

```env
# Essential configuration
DATABASE_URL=postgresql+asyncpg://username:password@localhost:5432/loctician_booking
SECRET_KEY=your-super-secret-key-generate-with-openssl-rand-hex-32
DEBUG=true
ENVIRONMENT=development
```

### 4. Start the Server

```bash
# Using the startup script (recommended)
python start.py

# Or directly with uvicorn
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 5. Verify Installation

- **API Documentation**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health
- **Database Health**: http://localhost:8000/health/db

## 🔧 Configuration

### Environment Variables

The application uses environment variables for configuration. See `.env.example` for all available options:

#### Essential Settings
- `DATABASE_URL`: PostgreSQL connection string
- `SECRET_KEY`: Secret used for session cookies and symmetric security features (32+ characters)
- `ENVIRONMENT`: Application environment (development/staging/production)
- `DEBUG`: Enable debug mode (true/false)

#### Security Settings
- `ACCESS_TOKEN_EXPIRE_MINUTES`: JWT token expiration (default: 30)
- `RATE_LIMIT_PER_MINUTE`: API rate limiting (default: 60)
- `CORS_ORIGINS`: Allowed CORS origins
- `JWT_PRIVATE_KEY`: RSA private key (PEM string or file path) used to sign JWTs
- `JWT_PUBLIC_KEY`: Optional RSA public key override. When omitted, the public key is derived from the private key
- `JWT_KEY_ID`: Identifier included in JWT headers and JWKS metadata

#### Feature Flags
- `ENABLE_GDPR_FEATURES`: Enable GDPR compliance endpoints
- `ENABLE_INSTAGRAM`: Enable Instagram integration
- `ENABLE_METRICS`: Enable Prometheus metrics

### Database Configuration

The application integrates deeply with PostgreSQL features:

1. **Row Level Security**: Automatic data isolation
2. **Security Functions**: Database-level authentication
3. **Full-Text Search**: Danish language support
4. **Scheduled Jobs**: Automated maintenance
5. **Audit Logging**: Comprehensive activity tracking

## 🔐 Authentication & Security

### JWT Authentication

The system uses PostgreSQL-based JWT authentication:

```python
# Login request
POST /api/v1/auth/login
{
    "email": "user@example.com",
    "password": "password"
}

# Response includes JWT tokens
{
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",
"token_type": "bearer",
"expires_in": 1800
}
```

### Neon RLS & JWKS Support

- The API now signs JWTs with an RSA key pair so Neon can validate requests via your JWKS endpoint.
- Configure the following environment variables with your RSA key material: `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY` (optional) and `JWT_KEY_ID`.
- Neon can fetch keys from either endpoint:
  - `/.well-known/jwks.json` (standard discovery path)
  - `/api/v1/auth/jwks` (namespaced API route)
- After updating the environment, restart the API so the JWKS document is refreshed.

### Role-Based Access Control

- **Customer**: Book appointments, view own bookings
- **Loctician**: Manage schedule, view assigned bookings
- **Staff**: Administrative functions
- **Admin**: Full system access

### Security Features

- **Rate Limiting**: Prevents API abuse
- **CSRF Protection**: Cross-site request forgery protection
- **SQL Injection Prevention**: Parameterized queries
- **Audit Logging**: All actions logged
- **Session Management**: Secure session handling

## 📊 API Endpoints

### Authentication
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Refresh token
- `POST /api/v1/auth/logout` - User logout
- `POST /api/v1/auth/change-password` - Change password

### Bookings
- `GET /api/v1/bookings` - List bookings
- `POST /api/v1/bookings` - Create booking
- `GET /api/v1/bookings/{id}` - Get booking details
- `PUT /api/v1/bookings/{id}` - Update booking
- `POST /api/v1/bookings/{id}/cancel` - Cancel booking
- `POST /api/v1/bookings/check-availability` - Check availability

### Real-Time Updates
- `WS /ws` - WebSocket for real-time updates
- `WS /ws/loctician/{id}` - Subscribe to loctician updates

## 🌐 WebSocket Support

Real-time updates for:
- Booking status changes
- Availability updates
- System notifications
- Admin broadcasts

```javascript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:8000/ws?token=your-jwt-token');

// Listen for booking updates
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'booking_update') {
        // Handle booking update
        console.log('Booking updated:', data.data);
    }
};
```

## 🧪 Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_bookings.py

# Run with verbose output
pytest -v
```

### Test Structure
- `tests/test_auth.py` - Authentication tests
- `tests/test_bookings.py` - Booking system tests
- `tests/test_api.py` - API endpoint tests
- `tests/test_security.py` - Security feature tests

## 📈 Monitoring & Logging

### Health Checks
- `/health` - Basic health status
- `/health/db` - Database connectivity
- `/health/ready` - Kubernetes readiness probe
- `/health/live` - Kubernetes liveness probe

### Structured Logging

The application uses structured JSON logging:

```json
{
    "timestamp": "2024-01-15T10:30:00Z",
    "level": "INFO",
    "logger": "app.api.bookings",
    "message": "Booking created successfully",
    "booking_id": "123e4567-e89b-12d3-a456-426614174000",
    "customer_id": "987fcdeb-51d3-4321-b987-123456789abc",
    "request_id": "req_123456789"
}
```

### Metrics

Prometheus metrics available at `/metrics` (when enabled):
- HTTP request duration
- Database query performance
- Active WebSocket connections
- Authentication success/failure rates

## 🌍 GDPR Compliance

### Data Export
```bash
# Export user data (Admin only)
GET /api/v1/users/{id}/export-data
```

### Data Anonymization
```bash
# Anonymize user data (Admin only)
POST /api/v1/users/{id}/anonymize
```

### Retention Management
- Automatic data retention handling
- Configurable retention periods
- Audit trail for all operations

## 🚀 Production Deployment

### Docker Deployment

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

CMD ["python", "start.py"]
```

### Environment Configuration

Production environment variables:

```env
ENVIRONMENT=production
DEBUG=false
SECRET_KEY=your-production-secret-key
DATABASE_URL=postgresql+asyncpg://user:pass@prod-db:5432/loctician_booking
REDIS_URL=redis://redis:6379/0
```

### Security Considerations

1. **Use HTTPS**: Always use SSL/TLS in production
2. **Secure Database**: Use connection encryption
3. **Environment Variables**: Never commit secrets
4. **Regular Updates**: Keep dependencies updated
5. **Monitoring**: Implement comprehensive monitoring

## 🤝 Development

### Code Style

The project uses:
- **Black**: Code formatting
- **isort**: Import sorting
- **Flake8**: Linting
- **Mypy**: Type checking

```bash
# Format code
black app/
isort app/

# Lint code
flake8 app/
mypy app/
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run the test suite
6. Submit a pull request

### Database Migrations

```bash
# Create migration
alembic revision --autogenerate -m "Description"

# Apply migrations
alembic upgrade head

# Downgrade migration
alembic downgrade -1
```

## 📚 Documentation

- **API Documentation**: Available at `/docs` when DEBUG=true
- **Database Schema**: See `schema.sql` for complete database design
- **Security Features**: See `security_enhancements.sql` for security implementation

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection**: Check DATABASE_URL format
2. **JWT Errors**: Verify SECRET_KEY configuration
3. **Permission Errors**: Check PostgreSQL user permissions
4. **CORS Issues**: Verify CORS_ORIGINS configuration

### Logs Location

- **Application Logs**: Stdout (JSON format)
- **Access Logs**: Uvicorn access logs
- **Database Logs**: PostgreSQL logs

> **Tip:** Set `SQL_ECHO=false` (default) to silence SQLAlchemy's query echo in
> local development. Enable it only when you need to inspect generated SQL
> statements.

### Debug Mode

Enable debug mode for development:

```env
DEBUG=true
LOG_LEVEL=DEBUG
SQL_ECHO=true
```

## 📄 License

This project is part of the Loctician Booking System. All rights reserved.

## 🤝 Support

For support, please contact the development team or create an issue in the project repository.

---

**Built with ❤️ for the Danish loctician community**