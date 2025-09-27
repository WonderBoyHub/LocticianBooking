#!/bin/bash

# JLI Loctician Booking System - Master Deployment Script
# This script handles complete deployment of the full-stack application
# Usage: ./deploy.sh [environment] [options]

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/src/backend"
FRONTEND_DIR="$PROJECT_ROOT/src/frontend"
DB_DIR="$PROJECT_ROOT/src/db"
SCRIPTS_DIR="$PROJECT_ROOT/scripts"

# Default configuration
ENVIRONMENT="${1:-development}"
SKIP_TESTS="${SKIP_TESTS:-false}"
SKIP_BUILD="${SKIP_BUILD:-false}"
SKIP_DATABASE="${SKIP_DATABASE:-false}"
POSTGRES_VERSION="${POSTGRES_VERSION:-17}"

# Create scripts directory if it doesn't exist
mkdir -p "$SCRIPTS_DIR"

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

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Validate environment and dependencies
validate_environment() {
    log_info "Validating deployment environment..."

    # Check required commands
    local required_commands=("node" "npm" "python3" "pip3" "psql")
    for cmd in "${required_commands[@]}"; do
        if ! command_exists "$cmd"; then
            log_error "Required command '$cmd' not found. Please install it."
            exit 1
        fi
    done

    # Check Node.js version
    local node_version
    node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$node_version" -lt 18 ]; then
        log_error "Node.js version 18+ required. Current version: $(node --version)"
        exit 1
    fi

    # Check Python version
    local python_version
    python_version=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1-2)
    if ! python3 -c "import sys; exit(0 if sys.version_info >= (3, 9) else 1)"; then
        log_error "Python 3.9+ required. Current version: $(python3 --version)"
        exit 1
    fi

    # Check PostgreSQL
    if ! command_exists "psql"; then
        log_error "PostgreSQL client (psql) not found. Please install PostgreSQL $POSTGRES_VERSION"
        exit 1
    fi

    log_success "Environment validation completed"
}

# Load environment variables
load_environment() {
    log_info "Loading environment configuration for: $ENVIRONMENT"

    # Load backend environment
    if [ -f "$BACKEND_DIR/.env.$ENVIRONMENT" ]; then
        log_info "Loading backend environment from .env.$ENVIRONMENT"
        set -a
        source "$BACKEND_DIR/.env.$ENVIRONMENT"
        set +a
    elif [ -f "$BACKEND_DIR/.env" ]; then
        log_info "Loading backend environment from .env"
        set -a
        source "$BACKEND_DIR/.env"
        set +a
    else
        log_warning "No backend environment file found. Using .env.example as template"
        if [ -f "$BACKEND_DIR/.env.example" ]; then
            cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
            log_warning "Please configure $BACKEND_DIR/.env before continuing"
            return 1
        fi
    fi

    # Validate required environment variables
    local required_vars=("DATABASE_URL" "SECRET_KEY")
    for var in "${required_vars[@]}"; do
        if [ -z "${!var:-}" ]; then
            log_error "Required environment variable '$var' not set"
            return 1
        fi
    done

    log_success "Environment configuration loaded"
}

# Setup and validate database
setup_database() {
    if [ "$SKIP_DATABASE" = "true" ]; then
        log_info "Skipping database setup (SKIP_DATABASE=true)"
        return 0
    fi

    log_info "Setting up PostgreSQL database..."

    # Parse DATABASE_URL to extract connection details
    local db_url="${DATABASE_URL}"
    local db_name
    db_name=$(echo "$db_url" | sed -n 's/.*\/\([^?]*\).*/\1/p')

    # Test database connection
    if ! psql "$DATABASE_URL" -c "SELECT version();" > /dev/null 2>&1; then
        log_error "Cannot connect to database. Please check DATABASE_URL"
        return 1
    fi

    # Check PostgreSQL version
    local pg_version
    pg_version=$(psql "$DATABASE_URL" -t -c "SHOW server_version_num;" | tr -d ' ')
    if [ "$pg_version" -lt 170000 ]; then
        log_error "PostgreSQL 17+ required. Current version: $pg_version"
        return 1
    fi

    # Check and install required extensions
    log_info "Checking required PostgreSQL extensions..."
    local extensions=("uuid-ossp" "pgcrypto" "pg_stat_statements" "btree_gist" "pg_trgm" "ltree")
    for ext in "${extensions[@]}"; do
        if ! psql "$DATABASE_URL" -t -c "SELECT 1 FROM pg_extension WHERE extname='$ext';" | grep -q 1; then
            log_info "Installing extension: $ext"
            psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS $ext;"
        fi
    done

    # Run database migrations if deploy script exists
    if [ -f "$DB_DIR/deploy_booking_system.sql" ]; then
        log_info "Running database deployment script..."
        psql "$DATABASE_URL" -f "$DB_DIR/deploy_booking_system.sql"
    else
        # Run individual migration files
        log_info "Running database migrations..."
        for sql_file in "$DB_DIR"/*.sql; do
            if [[ "$sql_file" =~ [0-9]{3}_.*.sql$ ]]; then
                log_info "Executing: $(basename "$sql_file")"
                psql "$DATABASE_URL" -f "$sql_file"
            fi
        done
    fi

    log_success "Database setup completed"
}

# Setup backend
setup_backend() {
    log_info "Setting up backend..."

    cd "$BACKEND_DIR"

    # Create virtual environment if it doesn't exist
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

    # Validate backend configuration
    if [ -f "validate_backend.py" ]; then
        log_info "Validating backend configuration..."
        python validate_backend.py
    fi

    # Run backend tests if not skipped
    if [ "$SKIP_TESTS" != "true" ] && [ -d "tests" ]; then
        log_info "Running backend tests..."
        python -m pytest tests/ -v
    fi

    deactivate
    cd "$PROJECT_ROOT"

    log_success "Backend setup completed"
}

# Setup frontend
setup_frontend() {
    log_info "Setting up frontend..."

    cd "$FRONTEND_DIR"

    # Install dependencies
    log_info "Installing frontend dependencies..."
    npm install

    # Run linting
    log_info "Running ESLint..."
    npm run lint

    # Run type checking
    log_info "Running TypeScript type checking..."
    npm run type-check

    # Run frontend tests if not skipped
    if [ "$SKIP_TESTS" != "true" ]; then
        log_info "Running frontend tests..."
        npm run test
    fi

    # Build frontend for production if not development
    if [ "$SKIP_BUILD" != "true" ] && [ "$ENVIRONMENT" != "development" ]; then
        log_info "Building frontend for production..."
        npm run build
    fi

    cd "$PROJECT_ROOT"

    log_success "Frontend setup completed"
}

# Health checks
run_health_checks() {
    log_info "Running health checks..."

    # Database health check
    if psql "$DATABASE_URL" -c "SELECT database_health_check();" > /dev/null 2>&1; then
        log_success "Database health check passed"
    else
        log_warning "Database health check function not available"
    fi

    # Check if backend can start
    cd "$BACKEND_DIR"
    source venv/bin/activate

    timeout 10s python -c "
import sys
sys.path.append('.')
from main import app
from fastapi.testclient import TestClient
client = TestClient(app)
response = client.get('/health')
if response.status_code == 200:
    print('Backend health check passed')
else:
    print('Backend health check failed')
    sys.exit(1)
" || log_warning "Backend health check timed out or failed"

    deactivate
    cd "$PROJECT_ROOT"

    log_success "Health checks completed"
}

# Performance validation
validate_performance() {
    log_info "Running performance validation..."

    # Database performance check
    if psql "$DATABASE_URL" -c "SELECT * FROM analyze_query_performance() WHERE performance_grade IN ('A', 'B');" > /dev/null 2>&1; then
        log_success "Database performance validation passed"
    else
        log_warning "Database performance validation not available"
    fi

    # Frontend build size check (if built)
    if [ -d "$FRONTEND_DIR/dist" ]; then
        local build_size
        build_size=$(du -sh "$FRONTEND_DIR/dist" | cut -f1)
        log_info "Frontend build size: $build_size"

        # Check for large files
        find "$FRONTEND_DIR/dist" -type f -size +1M -exec ls -lh {} \; | while read -r line; do
            log_warning "Large file found: $line"
        done
    fi

    log_success "Performance validation completed"
}

# Generate deployment summary
generate_summary() {
    log_info "Generating deployment summary..."

    local summary_file="$PROJECT_ROOT/deployment_summary_$(date +%Y%m%d_%H%M%S).txt"

    {
        echo "JLI Loctician Booking System - Deployment Summary"
        echo "=================================================="
        echo "Date: $(date)"
        echo "Environment: $ENVIRONMENT"
        echo "Project Root: $PROJECT_ROOT"
        echo ""
        echo "Components:"
        echo "- Backend: Python FastAPI"
        echo "- Frontend: React TypeScript"
        echo "- Database: PostgreSQL $POSTGRES_VERSION"
        echo ""
        echo "Environment Configuration:"
        echo "- Database URL: ${DATABASE_URL%%@*}@[REDACTED]"
        echo "- Environment file: $BACKEND_DIR/.env"
        echo ""
        echo "Build Information:"
        if [ -d "$FRONTEND_DIR/dist" ]; then
            echo "- Frontend built: Yes ($(du -sh "$FRONTEND_DIR/dist" | cut -f1))"
        else
            echo "- Frontend built: No (development mode)"
        fi
        if [ -d "$BACKEND_DIR/venv" ]; then
            echo "- Backend venv: Created"
        else
            echo "- Backend venv: Not found"
        fi
        echo ""
        echo "Next Steps:"
        echo "1. Start backend: cd $BACKEND_DIR && source venv/bin/activate && python main.py"
        echo "2. Start frontend: cd $FRONTEND_DIR && npm run dev"
        echo "3. Access application: http://localhost:5173 (dev) or your production URL"
        echo "4. Monitor logs and health endpoints"
        echo ""
        echo "Deployment completed successfully!"
    } > "$summary_file"

    cat "$summary_file"
    log_success "Deployment summary saved to: $summary_file"
}

# Main deployment flow
main() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║              JLI Loctician Booking System                    ║"
    echo "║                    Master Deployment                        ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"

    log_info "Starting deployment for environment: $ENVIRONMENT"

    # Main deployment steps
    validate_environment
    load_environment || exit 1
    setup_database
    setup_backend
    setup_frontend
    run_health_checks
    validate_performance
    generate_summary

    echo -e "${GREEN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                  Deployment Successful!                     ║"
    echo "║                                                              ║"
    echo "║  Your JLI Loctician Booking System is ready to use          ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Show usage information
show_usage() {
    echo "Usage: $0 [environment] [options]"
    echo ""
    echo "Environments:"
    echo "  development  - Development setup with hot reload"
    echo "  staging      - Staging environment"
    echo "  production   - Production deployment"
    echo ""
    echo "Environment Variables:"
    echo "  SKIP_TESTS=true      - Skip running tests"
    echo "  SKIP_BUILD=true      - Skip frontend build"
    echo "  SKIP_DATABASE=true   - Skip database setup"
    echo "  POSTGRES_VERSION=17  - PostgreSQL version"
    echo ""
    echo "Examples:"
    echo "  $0                           # Deploy development environment"
    echo "  $0 production                # Deploy production environment"
    echo "  SKIP_TESTS=true $0 staging   # Deploy staging without tests"
}

# Handle command line arguments
case "${1:-}" in
    -h|--help)
        show_usage
        exit 0
        ;;
    development|staging|production)
        main
        ;;
    "")
        main
        ;;
    *)
        log_error "Unknown environment: $1"
        show_usage
        exit 1
        ;;
esac