# Project Structure

```
jli/
├── backend/                     # Python FastAPI backend
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py             # FastAPI application entry point
│   │   ├── core/               # Core configuration and utilities
│   │   │   ├── config.py       # Settings and environment variables
│   │   │   ├── security.py     # Authentication and security
│   │   │   └── database.py     # Database connection and session
│   │   ├── api/                # API endpoints
│   │   │   ├── v1/
│   │   │   │   ├── auth.py     # Authentication endpoints
│   │   │   │   ├── users.py    # User management endpoints
│   │   │   │   ├── services.py # Service management endpoints
│   │   │   │   ├── bookings.py # Booking system endpoints
│   │   │   │   └── admin.py    # Admin dashboard endpoints
│   │   ├── models/             # SQLAlchemy models
│   │   │   ├── user.py
│   │   │   ├── service.py
│   │   │   ├── booking.py
│   │   │   └── audit.py
│   │   ├── schemas/            # Pydantic schemas for validation
│   │   │   ├── user.py
│   │   │   ├── service.py
│   │   │   ├── booking.py
│   │   │   └── auth.py
│   │   ├── services/           # Business logic layer
│   │   │   ├── auth_service.py
│   │   │   ├── booking_service.py
│   │   │   ├── email_service.py
│   │   │   └── compliance_service.py
│   │   ├── utils/              # Utility functions
│   │   │   ├── email.py
│   │   │   ├── security.py
│   │   │   └── validators.py
│   │   └── websocket/          # Real-time features
│   │       ├── manager.py      # WebSocket connection manager
│   │       └── handlers.py     # WebSocket event handlers
│   ├── requirements.txt        # Python dependencies
│   ├── Dockerfile             # Docker configuration
│   └── alembic/               # Database migrations
│
├── frontend/                   # React frontend
│   ├── public/
│   │   ├── index.html
│   │   └── favicon.ico
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   │   ├── common/         # Common components
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Input.tsx
│   │   │   │   ├── Modal.tsx
│   │   │   │   └── Layout.tsx
│   │   │   ├── auth/           # Authentication components
│   │   │   │   ├── LoginForm.tsx
│   │   │   │   └── RegisterForm.tsx
│   │   │   ├── booking/        # Booking system components
│   │   │   │   ├── ServiceList.tsx
│   │   │   │   ├── Calendar.tsx
│   │   │   │   ├── BookingForm.tsx
│   │   │   │   └── BookingHistory.tsx
│   │   │   └── admin/          # Admin dashboard components
│   │   │       ├── Dashboard.tsx
│   │   │       ├── UserManagement.tsx
│   │   │       └── Analytics.tsx
│   │   ├── pages/              # Page components
│   │   │   ├── HomePage.tsx
│   │   │   ├── ServicesPage.tsx
│   │   │   ├── BookingPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   └── AdminPage.tsx
│   │   ├── hooks/              # Custom React hooks
│   │   │   ├── useAuth.ts
│   │   │   ├── useBooking.ts
│   │   │   └── useWebSocket.ts
│   │   ├── services/           # API service layer
│   │   │   ├── api.ts          # Base API configuration
│   │   │   ├── auth.ts         # Authentication API calls
│   │   │   ├── booking.ts      # Booking API calls
│   │   │   └── services.ts     # Services API calls
│   │   ├── store/              # State management
│   │   │   ├── index.ts        # Store configuration
│   │   │   ├── authSlice.ts    # Authentication state
│   │   │   ├── bookingSlice.ts # Booking state
│   │   │   └── uiSlice.ts      # UI state
│   │   ├── styles/             # Styling
│   │   │   ├── globals.css     # Global styles
│   │   │   ├── colors.ts       # Brand color constants
│   │   │   └── theme.ts        # Theme configuration
│   │   ├── utils/              # Utility functions
│   │   │   ├── date.ts         # Date utilities
│   │   │   ├── validation.ts   # Form validation
│   │   │   └── constants.ts    # Application constants
│   │   ├── types/              # TypeScript type definitions
│   │   │   ├── auth.ts
│   │   │   ├── booking.ts
│   │   │   └── api.ts
│   │   ├── App.tsx             # Main application component
│   │   └── index.tsx           # Application entry point
│   ├── package.json            # Node.js dependencies
│   ├── tsconfig.json          # TypeScript configuration
│   └── tailwind.config.js     # Tailwind CSS configuration
│
├── docs/                       # Documentation
│   ├── api_contracts.md        # API documentation
│   ├── agent_coordination.md   # Agent assignments and dependencies
│   └── deployment_guide.md     # Deployment instructions
│
├── database/                   # Database files
│   ├── schema.sql             # Database schema (existing)
│   ├── sample_data.sql        # Sample data (existing)
│   └── migrations/            # Database migration scripts
│
├── docker-compose.yml         # Multi-service Docker setup
├── README.md                  # Project overview
└── .env.example              # Environment variables template
```

## Key Project Structure Notes

### Backend Organization
- **FastAPI** with modular architecture
- **SQLAlchemy** models mirror existing PostgreSQL schema
- **Pydantic** schemas for request/response validation
- **Alembic** for database migrations
- **WebSocket** support for real-time features

### Frontend Organization
- **React 18** with TypeScript
- **Redux Toolkit** for state management
- **Tailwind CSS** for styling with brand colors
- **Axios** for HTTP requests
- **React Router** for navigation
- **React Hook Form** for form management

### Brand Implementation
- Color constants defined in `/frontend/src/styles/colors.ts`
- Theme configuration in `/frontend/src/styles/theme.ts`
- Component library following warm brown/beige aesthetic
- Consistent spacing and typography system