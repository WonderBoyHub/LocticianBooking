# JLI Loctician Booking System

A comprehensive, production-ready booking system specifically designed for loctician businesses. Built with React, FastAPI, and PostgreSQL.

## Features

- **Complete Booking Management**: Calendar scheduling, service management, customer profiles
- **Payment Integration**: Mollie payment processing with Danish compliance
- **GDPR Compliant**: Full data protection and privacy compliance
- **Multi-language Support**: Danish and English localization
- **Real-time Updates**: WebSocket integration for live booking updates
- **Instagram Integration**: Showcase work and attract customers
- **Analytics Dashboard**: Business insights and performance metrics
- **Mobile Responsive**: Optimized for all devices

## Tech Stack

### Backend
- **FastAPI**: Modern Python web framework
- **PostgreSQL**: Advanced database with performance optimizations
- **SQLAlchemy**: ORM with async support
- **Alembic**: Database migrations
- **JWT Authentication**: Secure user sessions

### Frontend
- **React 18**: Modern React with hooks
- **TypeScript**: Type-safe development
- **Vite**: Fast build tool and dev server
- **React Query**: Server state management
- **React Hook Form**: Form handling with validation
- **React Router**: Client-side routing

## Quick Start

### Prerequisites
- PostgreSQL 15+
- Python 3.9+
- Node.js 18+
- npm or yarn

### 1. Database Setup
```bash
# Create database
createdb loctician_booking

# Apply schema (from src/db/)
psql loctician_booking < src/db/schema.sql
```

### 2. Backend Setup
```bash
cd src/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your database URL and other settings

# Start backend
python start.py
```

### 3. Frontend Setup
```bash
cd src/frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your API URL

# Start frontend
npm run dev
```

### 4. Access the Application
- **Frontend**: http://localhost:3000
- **API Documentation**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

## Project Structure

```
jli/
├── README.md                 # This file
├── .env.example             # Environment template
├── .gitignore               # Git ignore rules
├── docs/                    # Documentation
│   ├── setup/              # Setup guides
│   ├── deployment/         # Deployment guides
│   ├── architecture/       # System architecture
│   ├── legal/              # GDPR and compliance
│   └── operations/         # Operations and API docs
├── scripts/                # Utility scripts
├── src/
│   ├── backend/            # FastAPI application
│   ├── frontend/           # React application
│   └── db/                 # Database migrations and schema
└── brand_assets/           # Logo and branding
```

## Documentation

- **[Quick Setup Guide](docs/setup/START_HERE.md)**: Get started in 5 minutes
- **[Complete Setup Guide](docs/setup/COMPLETE_SETUP_GUIDE.md)**: Detailed installation
- **[Deployment Guide](docs/deployment/deployment_guide.md)**: Production deployment
- **[API Documentation](docs/operations/api_contracts.md)**: API endpoints and contracts
- **[Architecture Overview](docs/architecture/project_structure.md)**: System design

## Business Features

### For Locticians
- **Calendar Management**: Set availability, manage appointments
- **Service Management**: Define services, pricing, duration
- **Customer Management**: Customer profiles and history
- **Analytics**: Revenue tracking, popular services
- **Instagram Integration**: Showcase your work

### For Customers
- **Easy Booking**: Browse services and book appointments
- **Account Management**: View booking history and profile
- **Email Notifications**: Booking confirmations and reminders
- **Mobile Friendly**: Book from any device

## Development

### Running Tests
```bash
# Backend tests
cd src/backend
pytest

# Frontend tests
cd src/frontend
npm test
```

### Database Migrations
```bash
cd src/backend
alembic upgrade head
```

### Code Quality
```bash
# Backend linting
cd src/backend
black . && isort . && flake8

# Frontend linting
cd src/frontend
npm run lint
```

## Deployment

For production deployment, see:
- **[PostgreSQL Deployment Guide](docs/deployment/deployment_guide.md)**
- **[Booking System Deployment](docs/deployment/BOOKING_SYSTEM_DEPLOYMENT_GUIDE.md)**

## Configuration

Copy `.env.example` to `.env` and configure:

### Required Settings
- `DATABASE_URL`: PostgreSQL connection string
- `SECRET_KEY`: JWT secret key
- `SMTP_*`: Email configuration
- `MOLLIE_API_KEY`: Payment processing

### Optional Settings
- `INSTAGRAM_*`: Instagram integration
- `CORS_ORIGINS`: Allowed frontend origins
- Feature flags and business rules

## Security

- **JWT Authentication**: Secure user sessions
- **CORS Protection**: Configurable cross-origin requests
- **GDPR Compliance**: Data protection and user rights
- **Rate Limiting**: API protection
- **SQL Injection Protection**: Parameterized queries
- **XSS Protection**: Input sanitization

## Support

- **Issues**: Report bugs and feature requests
- **Documentation**: Comprehensive guides in `/docs`
- **API Docs**: Interactive API documentation at `/docs`

## License

Copyright (c) 2024 JLI Loctician Booking System. All rights reserved.

---

**Ready for production deployment with enterprise-grade features!**