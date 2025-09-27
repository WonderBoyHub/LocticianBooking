#!/bin/bash

# JLI Loctician Booking System - Development Environment Setup
# This script sets up a complete development environment with hot reload and debugging

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/src/backend"
FRONTEND_DIR="$PROJECT_ROOT/src/frontend"
DB_DIR="$PROJECT_ROOT/src/db"

# Development configuration
DEV_DATABASE_NAME="${DEV_DATABASE_NAME:-jli_dev}"
DEV_DATABASE_USER="${DEV_DATABASE_USER:-jli_dev}"
DEV_DATABASE_PASS="${DEV_DATABASE_PASS:-jli_dev_pass}"
DEV_DATABASE_HOST="${DEV_DATABASE_HOST:-localhost}"
DEV_DATABASE_PORT="${DEV_DATABASE_PORT:-5432}"

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_section() {
    echo -e "\n${PURPLE}=== $1 ===${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Install system dependencies
install_system_dependencies() {
    log_section "Installing System Dependencies"

    # Check operating system
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        log_info "Detected macOS"

        # Check if Homebrew is installed
        if ! command_exists brew; then
            log_info "Installing Homebrew..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        fi

        # Install dependencies
        log_info "Installing system dependencies via Homebrew..."
        brew update
        brew install postgresql@17 node python@3.11 redis

        # Start services
        brew services start postgresql@17
        brew services start redis

    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        log_info "Detected Linux"

        # Check for package manager
        if command_exists apt-get; then
            # Ubuntu/Debian
            log_info "Installing dependencies via apt..."
            sudo apt-get update
            sudo apt-get install -y postgresql-17 postgresql-client-17 nodejs npm python3.11 python3.11-venv python3-pip redis-server

            # Start services
            sudo systemctl start postgresql
            sudo systemctl start redis-server
            sudo systemctl enable postgresql
            sudo systemctl enable redis-server

        elif command_exists yum; then
            # CentOS/RHEL
            log_info "Installing dependencies via yum..."
            sudo yum update -y
            sudo yum install -y postgresql17-server postgresql17 nodejs npm python3.11 python3-pip redis

            # Initialize and start PostgreSQL
            sudo postgresql-setup initdb
            sudo systemctl start postgresql
            sudo systemctl start redis
            sudo systemctl enable postgresql
            sudo systemctl enable redis

        else
            log_error "Unsupported Linux distribution. Please install dependencies manually."
            exit 1
        fi
    else
        log_error "Unsupported operating system: $OSTYPE"
        exit 1
    fi

    log_success "System dependencies installed"
}

# Setup development database
setup_dev_database() {
    log_section "Setting Up Development Database"

    # Check if PostgreSQL is running
    if ! pg_isready -h "$DEV_DATABASE_HOST" -p "$DEV_DATABASE_PORT" > /dev/null 2>&1; then
        log_error "PostgreSQL is not running. Please start PostgreSQL service."
        return 1
    fi

    # Create development database and user
    log_info "Creating development database and user..."

    # Connect as postgres user to create database and user
    sudo -u postgres psql << EOF || {
        log_warning "Could not create database as postgres user, trying as current user..."
        createdb "$DEV_DATABASE_NAME" 2>/dev/null || true
        psql -d "$DEV_DATABASE_NAME" -c "SELECT 1;" > /dev/null 2>&1 || {
            log_error "Cannot access database. Please create database manually:"
            echo "  createdb $DEV_DATABASE_NAME"
            return 1
        }
    }
CREATE DATABASE $DEV_DATABASE_NAME;
CREATE USER $DEV_DATABASE_USER WITH PASSWORD '$DEV_DATABASE_PASS';
GRANT ALL PRIVILEGES ON DATABASE $DEV_DATABASE_NAME TO $DEV_DATABASE_USER;
ALTER USER $DEV_DATABASE_USER CREATEDB;
\\q
EOF

    # Set database URL for development
    export DATABASE_URL="postgresql://$DEV_DATABASE_USER:$DEV_DATABASE_PASS@$DEV_DATABASE_HOST:$DEV_DATABASE_PORT/$DEV_DATABASE_NAME"

    # Test database connection
    if psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
        log_success "Development database created and accessible"
    else
        log_error "Cannot connect to development database"
        return 1
    fi

    # Install required PostgreSQL extensions
    log_info "Installing required PostgreSQL extensions..."
    psql "$DATABASE_URL" << EOF
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "ltree";
EOF

    # Run database migrations
    if [ -f "$DB_DIR/deploy_booking_system.sql" ]; then
        log_info "Running database migrations..."
        psql "$DATABASE_URL" -f "$DB_DIR/deploy_booking_system.sql"
    else
        log_info "Running individual migration files..."
        for sql_file in "$DB_DIR"/*.sql; do
            if [[ "$sql_file" =~ [0-9]{3}_.*.sql$ ]]; then
                log_info "Executing: $(basename "$sql_file")"
                psql "$DATABASE_URL" -f "$sql_file"
            fi
        done
    fi

    log_success "Development database setup completed"
}

# Setup backend development environment
setup_backend_dev() {
    log_section "Setting Up Backend Development Environment"

    cd "$BACKEND_DIR"

    # Create virtual environment
    if [ ! -d "venv" ]; then
        log_info "Creating Python virtual environment..."
        python3 -m venv venv
    fi

    # Activate virtual environment
    source venv/bin/activate

    # Upgrade pip and install dependencies
    log_info "Installing Python dependencies..."
    pip install --upgrade pip
    pip install -r requirements.txt

    # Install development dependencies
    log_info "Installing development dependencies..."
    pip install pytest-cov pytest-mock pytest-asyncio black isort mypy

    # Create development environment file
    log_info "Creating development environment configuration..."
    cat > .env.development << EOF
# Development Environment Configuration
DATABASE_URL=$DATABASE_URL
SECRET_KEY=dev-secret-key-change-in-production
MOLLIE_API_KEY=test_dHar4XY7LxsDOtmnkVtjNVWXLSlXsM
ENVIRONMENT=development
DEBUG=true
LOG_LEVEL=DEBUG
CORS_ORIGINS=["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"]

# Hot reload settings
RELOAD=true
WORKERS=1

# Development features
ENABLE_DOCS=true
ENABLE_ADMIN=true
ENABLE_PROFILING=true

# Email settings (development)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
SMTP_TLS=false
SMTP_SSL=false

# Redis settings
REDIS_URL=redis://localhost:6379/0

# File upload settings
UPLOAD_DIR=./uploads
MAX_UPLOAD_SIZE=10485760

# Logging
LOG_FILE=./logs/app.log
LOG_ROTATION=daily
LOG_RETENTION=7
EOF

    # Copy to .env for default usage
    cp .env.development .env

    # Create logs directory
    mkdir -p logs

    # Create uploads directory
    mkdir -p uploads

    # Create development startup script
    cat > start_dev.sh << 'EOF'
#!/bin/bash
source venv/bin/activate
export ENVIRONMENT=development
uvicorn main:app --host 0.0.0.0 --port 8000 --reload --log-level debug
EOF

    chmod +x start_dev.sh

    # Create debug configuration for VS Code
    mkdir -p .vscode
    cat > .vscode/launch.json << EOF
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Debug FastAPI",
            "type": "python",
            "request": "launch",
            "program": "\${workspaceFolder}/src/backend/main.py",
            "args": [],
            "console": "integratedTerminal",
            "env": {
                "ENVIRONMENT": "development",
                "DEBUG": "true"
            },
            "python": "\${workspaceFolder}/src/backend/venv/bin/python",
            "cwd": "\${workspaceFolder}/src/backend"
        }
    ]
}
EOF

    deactivate
    cd "$PROJECT_ROOT"

    log_success "Backend development environment setup completed"
}

# Setup frontend development environment
setup_frontend_dev() {
    log_section "Setting Up Frontend Development Environment"

    cd "$FRONTEND_DIR"

    # Install dependencies
    log_info "Installing frontend dependencies..."
    npm install

    # Install additional development tools
    log_info "Installing development tools..."
    npm install --save-dev @storybook/react-vite @storybook/addon-essentials @storybook/addon-interactions @storybook/testing-library

    # Create development environment file
    log_info "Creating frontend environment configuration..."
    cat > .env.development << EOF
# Frontend Development Configuration
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws
VITE_ENVIRONMENT=development
VITE_DEBUG=true
VITE_MOCK_API=false

# Feature flags
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_ERROR_REPORTING=false
VITE_ENABLE_HOT_RELOAD=true

# Mollie configuration (development)
VITE_MOLLIE_PROFILE_ID=pfl_test123
VITE_MOLLIE_TEST_MODE=true

# Development tools
VITE_DEVTOOLS=true
VITE_REDUX_DEVTOOLS=true
VITE_REACT_QUERY_DEVTOOLS=true
EOF

    # Copy to .env for default usage
    cp .env.development .env

    # Update vite.config.ts for better development experience
    if [ -f "vite.config.ts" ]; then
        cp vite.config.ts vite.config.ts.backup
    fi

    cat > vite.config.ts << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    open: true,
    cors: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
        changeOrigin: true
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@types': path.resolve(__dirname, './src/types'),
      '@assets': path.resolve(__dirname, './src/assets')
    }
  },
  build: {
    sourcemap: true,
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          ui: ['framer-motion', 'lucide-react'],
          forms: ['react-hook-form', '@hookform/resolvers'],
          state: ['@reduxjs/toolkit', 'react-redux'],
          query: ['@tanstack/react-query']
        }
      }
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom']
  }
})
EOF

    # Create development scripts
    cat > package.json.tmp << EOF
{
  "name": "jli-loctician-frontend",
  "version": "1.0.0",
  "description": "Professional loctician booking system frontend",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "vite --mode development",
    "dev:debug": "vite --mode development --debug",
    "dev:network": "vite --host 0.0.0.0 --mode development",
    "build": "tsc && vite build",
    "build:dev": "tsc && vite build --mode development",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "lint:fix": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0 --fix",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:watch": "vitest --watch",
    "type-check": "tsc --noEmit",
    "type-check:watch": "tsc --noEmit --watch",
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build"
  }
EOF

    # Merge with existing package.json dependencies
    if [ -f "package.json" ]; then
        node -e "
        const existing = require('./package.json');
        const newPkg = require('./package.json.tmp');
        const merged = { ...existing, scripts: { ...existing.scripts, ...newPkg.scripts } };
        console.log(JSON.stringify(merged, null, 2));
        " > package.json.new && mv package.json.new package.json
    fi

    rm -f package.json.tmp

    # Create VS Code configuration for frontend
    mkdir -p .vscode
    cat > .vscode/settings.json << EOF
{
    "typescript.preferences.importModuleSpecifier": "relative",
    "editor.codeActionsOnSave": {
        "source.fixAll.eslint": true
    },
    "emmet.includeLanguages": {
        "typescript": "html",
        "typescriptreact": "html"
    },
    "files.associations": {
        "*.css": "tailwindcss"
    },
    "editor.quickSuggestions": {
        "strings": true
    }
}
EOF

    cd "$PROJECT_ROOT"

    log_success "Frontend development environment setup completed"
}

# Setup development tools and utilities
setup_dev_tools() {
    log_section "Setting Up Development Tools"

    # Create global development script
    cat > start_dev_full.sh << 'EOF'
#!/bin/bash

# JLI Loctician Booking System - Full Development Startup

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/src/backend"
FRONTEND_DIR="$PROJECT_ROOT/src/frontend"

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Function to kill background processes on exit
cleanup() {
    echo "Shutting down development servers..."
    jobs -p | xargs -r kill
    exit 0
}

trap cleanup EXIT INT TERM

echo "🚀 Starting JLI Loctician Booking System Development Environment"
echo "================================================================"

# Start backend
log_info "Starting backend server on http://localhost:8000"
cd "$BACKEND_DIR"
source venv/bin/activate
python main.py &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Start frontend
log_info "Starting frontend server on http://localhost:5173"
cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!

# Wait for frontend to start
sleep 3

log_success "Development environment is ready!"
echo ""
echo "📊 Available Services:"
echo "  Frontend:  http://localhost:5173"
echo "  Backend:   http://localhost:8000"
echo "  API Docs:  http://localhost:8000/docs"
echo "  Database:  postgresql://localhost:5432/jli_dev"
echo ""
echo "🛠️  Development Tools:"
echo "  Backend Logs:  tail -f $BACKEND_DIR/logs/app.log"
echo "  Test Suite:    $PROJECT_ROOT/scripts/test_suite.sh"
echo "  DB Console:    psql postgresql://jli_dev:jli_dev_pass@localhost:5432/jli_dev"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for background processes
wait
EOF

    chmod +x start_dev_full.sh

    # Create database console script
    cat > db_console.sh << EOF
#!/bin/bash
# Quick database console access
export DATABASE_URL="postgresql://$DEV_DATABASE_USER:$DEV_DATABASE_PASS@$DEV_DATABASE_HOST:$DEV_DATABASE_PORT/$DEV_DATABASE_NAME"
psql "\$DATABASE_URL"
EOF

    chmod +x db_console.sh

    # Create test data seeding script
    cat > scripts/seed_test_data.sh << 'EOF'
#!/bin/bash

# Seed test data for development

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/src/backend"

# Load environment
if [ -f "$BACKEND_DIR/.env" ]; then
    source "$BACKEND_DIR/.env"
fi

log_info() {
    echo -e "\033[0;34m[INFO]\033[0m $1"
}

log_info "Seeding test data for development..."

# Connect to database and seed test data
psql "$DATABASE_URL" << 'EOSQL'
-- Insert test users
INSERT INTO users (email, password_hash, role, first_name, last_name, phone, is_active, email_verified)
VALUES
    ('admin@jli.dk', '$2b$12$example_hash_admin', 'admin', 'Admin', 'User', '+45 12345678', true, true),
    ('staff@jli.dk', '$2b$12$example_hash_staff', 'staff', 'Staff', 'Member', '+45 12345679', true, true),
    ('customer@jli.dk', '$2b$12$example_hash_customer', 'customer', 'Test', 'Customer', '+45 12345680', true, true)
ON CONFLICT (email) DO NOTHING;

-- Insert test services
INSERT INTO services (name, description, duration_minutes, price_dkk, category, is_active)
VALUES
    ('Loc Maintenance', 'Professional loc maintenance and styling', 120, 500, 'maintenance', true),
    ('New Locs Installation', 'Installation of new locs', 240, 1200, 'installation', true),
    ('Loc Repair', 'Repair and restoration of damaged locs', 90, 350, 'repair', true),
    ('Consultation', 'Hair and loc consultation session', 30, 150, 'consultation', true)
ON CONFLICT (name) DO NOTHING;

-- Insert test bookings
INSERT INTO bookings (user_id, service_id, staff_id, booking_time, duration_minutes, status, notes)
SELECT
    u.id,
    s.id,
    (SELECT id FROM users WHERE role = 'staff' LIMIT 1),
    CURRENT_TIMESTAMP + INTERVAL '1 day' + (INTERVAL '1 hour' * generate_series(1, 5)),
    s.duration_minutes,
    'confirmed',
    'Test booking for development'
FROM users u, services s
WHERE u.email = 'customer@jli.dk' AND s.name = 'Loc Maintenance'
LIMIT 3
ON CONFLICT DO NOTHING;
EOSQL

log_info "Test data seeded successfully!"
EOF

    chmod +x scripts/seed_test_data.sh

    # Create debugging helper script
    cat > scripts/debug_helper.sh << 'EOF'
#!/bin/bash

# Development debugging helper

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/src/backend"

case "${1:-help}" in
    "logs")
        echo "📋 Backend Logs:"
        tail -f "$BACKEND_DIR/logs/app.log"
        ;;
    "db")
        echo "🗄️  Database Console:"
        "$PROJECT_ROOT/db_console.sh"
        ;;
    "test")
        echo "🧪 Running Tests:"
        "$PROJECT_ROOT/scripts/test_suite.sh"
        ;;
    "reset-db")
        echo "🔄 Resetting Database:"
        read -p "Are you sure? This will delete all data (y/N): " -n 1 -r
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            dropdb jli_dev || true
            createdb jli_dev
            "$PROJECT_ROOT/scripts/dev_setup.sh" setup-db-only
        fi
        ;;
    "help"|*)
        echo "🛠️  Development Helper Commands:"
        echo "  $0 logs       - Show backend logs"
        echo "  $0 db         - Open database console"
        echo "  $0 test       - Run test suite"
        echo "  $0 reset-db   - Reset development database"
        ;;
esac
EOF

    chmod +x scripts/debug_helper.sh

    log_success "Development tools setup completed"
}

# Create development documentation
create_dev_docs() {
    log_section "Creating Development Documentation"

    cat > DEVELOPMENT.md << 'EOF'
# JLI Loctician Booking System - Development Guide

## Quick Start

1. **Setup Development Environment:**
   ```bash
   ./scripts/dev_setup.sh
   ```

2. **Start Development Servers:**
   ```bash
   ./start_dev_full.sh
   ```

3. **Access Services:**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs
   - Database: postgresql://localhost:5432/jli_dev

## Development Workflow

### Backend Development

```bash
cd src/backend
source venv/bin/activate
python main.py
```

**Key Features:**
- Hot reload enabled by default
- Debug mode with detailed logging
- Automatic API documentation at `/docs`
- Environment variables in `.env.development`

### Frontend Development

```bash
cd src/frontend
npm run dev
```

**Key Features:**
- Hot Module Replacement (HMR)
- TypeScript type checking
- ESLint and Prettier integration
- Proxy configuration for API calls

### Database Development

**Quick Console Access:**
```bash
./db_console.sh
```

**Reset Database:**
```bash
./scripts/debug_helper.sh reset-db
```

**Seed Test Data:**
```bash
./scripts/seed_test_data.sh
```

## Testing

**Run All Tests:**
```bash
./scripts/test_suite.sh
```

**Backend Tests Only:**
```bash
cd src/backend
source venv/bin/activate
pytest
```

**Frontend Tests Only:**
```bash
cd src/frontend
npm test
```

## Debugging

### VS Code Configuration

The setup includes VS Code configurations for:
- Python debugging (Backend)
- TypeScript debugging (Frontend)
- Integrated terminal setup
- Extension recommendations

### Debugging Tools

```bash
# View backend logs
./scripts/debug_helper.sh logs

# Open database console
./scripts/debug_helper.sh db

# Run tests
./scripts/debug_helper.sh test
```

## Code Quality

### Backend

- **Linting:** `black` and `isort`
- **Type Checking:** `mypy`
- **Testing:** `pytest` with coverage

### Frontend

- **Linting:** ESLint with TypeScript rules
- **Type Checking:** TypeScript compiler
- **Testing:** Vitest with React Testing Library

## Environment Variables

### Backend (.env.development)

```env
DATABASE_URL=postgresql://jli_dev:jli_dev_pass@localhost:5432/jli_dev
SECRET_KEY=dev-secret-key-change-in-production
DEBUG=true
MOLLIE_API_KEY=test_dHar4XY7LxsDOtmnkVtjNVWXLSlXsM
```

### Frontend (.env.development)

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws
VITE_ENVIRONMENT=development
VITE_DEBUG=true
```

## Project Structure

```
jli/
├── src/
│   ├── backend/          # FastAPI backend
│   │   ├── app/          # Application code
│   │   ├── tests/        # Backend tests
│   │   ├── logs/         # Log files
│   │   └── venv/         # Python virtual environment
│   ├── frontend/         # React frontend
│   │   ├── src/          # Source code
│   │   ├── public/       # Static assets
│   │   └── dist/         # Built application
│   └── db/               # Database migrations
├── scripts/              # Utility scripts
└── deploy.sh            # Main deployment script
```

## Common Tasks

### Adding a New API Endpoint

1. Create endpoint in `src/backend/app/api/`
2. Add route to main router
3. Write tests in `src/backend/tests/`
4. Update frontend API client

### Adding a New React Component

1. Create component in `src/frontend/src/components/`
2. Add TypeScript types
3. Write tests with React Testing Library
4. Update story for Storybook (if applicable)

### Database Changes

1. Create new migration file in `src/db/`
2. Test migration locally
3. Update any affected API endpoints
4. Update frontend data models

## Performance Monitoring

### Backend

- Structured logging with `structlog`
- Request timing middleware
- Database query monitoring
- Memory usage tracking

### Frontend

- React DevTools integration
- Bundle size monitoring
- Performance profiling with Lighthouse

## Troubleshooting

### Common Issues

1. **Port already in use:**
   ```bash
   lsof -ti:8000 | xargs kill  # Kill backend
   lsof -ti:5173 | xargs kill  # Kill frontend
   ```

2. **Database connection failed:**
   ```bash
   pg_isready -h localhost -p 5432
   ./scripts/debug_helper.sh reset-db
   ```

3. **Module not found errors:**
   ```bash
   cd src/backend && source venv/bin/activate && pip install -r requirements.txt
   cd src/frontend && npm install
   ```

### Getting Help

- Check logs: `./scripts/debug_helper.sh logs`
- Run health checks: `curl http://localhost:8000/health`
- Review test results: `./scripts/test_suite.sh`

## Production Deployment

When ready for production:

1. Run production checklist: `./scripts/production_checklist.sh`
2. Run full test suite: `./scripts/test_suite.sh`
3. Deploy: `./deploy.sh production`

For more deployment information, see the main deployment documentation.
EOF

    log_success "Development documentation created"
}

# Main setup function
main() {
    echo -e "${PURPLE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║              JLI Loctician Booking System                    ║"
    echo "║               Development Environment Setup                  ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"

    log_info "Setting up development environment..."

    case "${1:-all}" in
        "deps"|"dependencies")
            install_system_dependencies
            ;;
        "db"|"database")
            setup_dev_database
            ;;
        "backend")
            setup_backend_dev
            ;;
        "frontend")
            setup_frontend_dev
            ;;
        "tools")
            setup_dev_tools
            ;;
        "docs")
            create_dev_docs
            ;;
        "setup-db-only")
            setup_dev_database
            ;;
        "all"|*)
            install_system_dependencies
            setup_dev_database
            setup_backend_dev
            setup_frontend_dev
            setup_dev_tools
            create_dev_docs
            ;;
    esac

    if [ "${1:-all}" = "all" ]; then
        echo ""
        echo -e "${GREEN}"
        echo "╔══════════════════════════════════════════════════════════════╗"
        echo "║                Development Setup Complete!                   ║"
        echo "║                                                              ║"
        echo "║  Start development:  ./start_dev_full.sh                    ║"
        echo "║  Access frontend:    http://localhost:5173                  ║"
        echo "║  Access backend:     http://localhost:8000                  ║"
        echo "║  API documentation:  http://localhost:8000/docs             ║"
        echo "║                                                              ║"
        echo "║  Need help?          ./scripts/debug_helper.sh              ║"
        echo "╚══════════════════════════════════════════════════════════════╝"
        echo -e "${NC}"
    fi
}

# Show usage information
show_usage() {
    echo "Usage: $0 [component]"
    echo ""
    echo "Components:"
    echo "  all          - Setup complete development environment (default)"
    echo "  deps         - Install system dependencies only"
    echo "  database     - Setup development database only"
    echo "  backend      - Setup backend development environment only"
    echo "  frontend     - Setup frontend development environment only"
    echo "  tools        - Setup development tools only"
    echo "  docs         - Create development documentation only"
    echo ""
    echo "Environment Variables:"
    echo "  DEV_DATABASE_NAME=jli_dev       - Development database name"
    echo "  DEV_DATABASE_USER=jli_dev       - Development database user"
    echo "  DEV_DATABASE_PASS=jli_dev_pass  - Development database password"
    echo "  BACKEND_PORT=8000               - Backend server port"
    echo "  FRONTEND_PORT=5173              - Frontend server port"
    echo ""
    echo "Examples:"
    echo "  $0                    # Full setup"
    echo "  $0 backend            # Backend only"
    echo "  $0 frontend           # Frontend only"
    echo "  BACKEND_PORT=8080 $0  # Custom backend port"
}

# Handle command line arguments
case "${1:-}" in
    -h|--help)
        show_usage
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac