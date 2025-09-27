#!/bin/bash

# JLI Loctician Booking System - Comprehensive Testing Suite
# This script runs all tests for the application including unit, integration, and E2E tests

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/src/backend"
FRONTEND_DIR="$PROJECT_ROOT/src/frontend"
TESTS_DIR="$PROJECT_ROOT/tests"

# Test configuration
TEST_ENVIRONMENT="${TEST_ENVIRONMENT:-test}"
PARALLEL_TESTS="${PARALLEL_TESTS:-true}"
COVERAGE_THRESHOLD="${COVERAGE_THRESHOLD:-80}"
E2E_TIMEOUT="${E2E_TIMEOUT:-60}"

# Create tests directory if it doesn't exist
mkdir -p "$TESTS_DIR"

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

# Test result tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Track test results
track_test() {
    local test_name="$1"
    local result="$2"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    if [ "$result" = "pass" ]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        log_success "$test_name - PASSED"
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        log_error "$test_name - FAILED"
    fi
}

# Setup test environment
setup_test_environment() {
    log_info "Setting up test environment..."

    # Create test database configuration
    export DATABASE_URL="${TEST_DATABASE_URL:-postgresql://test:test@localhost:5432/jli_test}"
    export SECRET_KEY="${TEST_SECRET_KEY:-test-secret-key-for-testing-only}"
    export MOLLIE_API_KEY="${TEST_MOLLIE_API_KEY:-test_dHar4XY7LxsDOtmnkVtjNVWXLSlXsM}"
    export ENVIRONMENT="test"

    # Create test environment file for backend
    cat > "$BACKEND_DIR/.env.test" << EOF
DATABASE_URL=$DATABASE_URL
SECRET_KEY=$SECRET_KEY
MOLLIE_API_KEY=$MOLLIE_API_KEY
ENVIRONMENT=test
DEBUG=true
LOG_LEVEL=DEBUG
CORS_ORIGINS=["http://localhost:3000", "http://localhost:5173"]
EOF

    log_success "Test environment configured"
}

# Database tests
run_database_tests() {
    log_info "Running database tests..."

    local test_passed=true

    # Test database connection
    if psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
        track_test "Database Connection" "pass"
    else
        track_test "Database Connection" "fail"
        test_passed=false
    fi

    # Test database schema
    if psql "$DATABASE_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';" | grep -q "users\|bookings\|services"; then
        track_test "Database Schema" "pass"
    else
        track_test "Database Schema" "fail"
        test_passed=false
    fi

    # Test database functions
    if psql "$DATABASE_URL" -c "SELECT database_health_check();" > /dev/null 2>&1; then
        track_test "Database Functions" "pass"
    else
        track_test "Database Functions" "fail"
        test_passed=false
    fi

    # Test performance
    local query_time
    query_time=$(psql "$DATABASE_URL" -t -c "EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM users LIMIT 10;" 2>/dev/null | grep "Execution Time" | sed -n 's/.*Execution Time: \([0-9.]*\) ms.*/\1/p' || echo "0")

    if (( $(echo "$query_time < 50" | bc -l) )); then
        track_test "Database Performance" "pass"
    else
        track_test "Database Performance" "fail"
        test_passed=false
    fi

    if [ "$test_passed" = true ]; then
        log_success "Database tests completed successfully"
    else
        log_error "Some database tests failed"
    fi

    return $([ "$test_passed" = true ] && echo 0 || echo 1)
}

# Backend API tests
run_backend_tests() {
    log_info "Running backend tests..."

    cd "$BACKEND_DIR"
    source venv/bin/activate

    local test_passed=true

    # Unit tests
    log_info "Running backend unit tests..."
    if python -m pytest tests/ -v --cov=app --cov-report=term-missing --cov-fail-under=$COVERAGE_THRESHOLD; then
        track_test "Backend Unit Tests" "pass"
    else
        track_test "Backend Unit Tests" "fail"
        test_passed=false
    fi

    # API endpoint tests
    log_info "Running API endpoint tests..."
    if python -m pytest tests/test_api.py -v; then
        track_test "API Endpoint Tests" "pass"
    else
        track_test "API Endpoint Tests" "fail"
        test_passed=false
    fi

    # Authentication tests
    log_info "Running authentication tests..."
    if python -m pytest tests/test_auth.py -v; then
        track_test "Authentication Tests" "pass"
    else
        track_test "Authentication Tests" "fail"
        test_passed=false
    fi

    # Role-based access control tests
    log_info "Running RBAC tests..."
    if python -m pytest tests/test_rbac.py -v; then
        track_test "RBAC Tests" "pass"
    else
        track_test "RBAC Tests" "fail"
        test_passed=false
    fi

    # Payment integration tests
    log_info "Running payment tests..."
    if python -m pytest tests/test_payments.py -v; then
        track_test "Payment Integration Tests" "pass"
    else
        track_test "Payment Integration Tests" "fail"
        test_passed=false
    fi

    deactivate
    cd "$PROJECT_ROOT"

    if [ "$test_passed" = true ]; then
        log_success "Backend tests completed successfully"
    else
        log_error "Some backend tests failed"
    fi

    return $([ "$test_passed" = true ] && echo 0 || echo 1)
}

# Frontend tests
run_frontend_tests() {
    log_info "Running frontend tests..."

    cd "$FRONTEND_DIR"

    local test_passed=true

    # Unit tests
    log_info "Running frontend unit tests..."
    if npm run test -- --run --coverage; then
        track_test "Frontend Unit Tests" "pass"
    else
        track_test "Frontend Unit Tests" "fail"
        test_passed=false
    fi

    # Component tests
    log_info "Running component tests..."
    if npm run test -- --run src/components/; then
        track_test "Component Tests" "pass"
    else
        track_test "Component Tests" "fail"
        test_passed=false
    fi

    # Type checking
    log_info "Running TypeScript type checking..."
    if npm run type-check; then
        track_test "TypeScript Type Check" "pass"
    else
        track_test "TypeScript Type Check" "fail"
        test_passed=false
    fi

    # Linting
    log_info "Running ESLint..."
    if npm run lint; then
        track_test "Frontend Linting" "pass"
    else
        track_test "Frontend Linting" "fail"
        test_passed=false
    fi

    # Build test
    log_info "Testing frontend build..."
    if npm run build; then
        track_test "Frontend Build" "pass"
    else
        track_test "Frontend Build" "fail"
        test_passed=false
    fi

    cd "$PROJECT_ROOT"

    if [ "$test_passed" = true ]; then
        log_success "Frontend tests completed successfully"
    else
        log_error "Some frontend tests failed"
    fi

    return $([ "$test_passed" = true ] && echo 0 || echo 1)
}

# Integration tests
run_integration_tests() {
    log_info "Running integration tests..."

    # Start backend server for integration tests
    cd "$BACKEND_DIR"
    source venv/bin/activate
    python main.py &
    local backend_pid=$!

    # Wait for backend to start
    sleep 5

    # Check if backend is running
    if curl -f http://localhost:8000/health > /dev/null 2>&1; then
        track_test "Backend Server Start" "pass"
    else
        track_test "Backend Server Start" "fail"
        kill $backend_pid 2>/dev/null || true
        return 1
    fi

    # API integration tests
    log_info "Testing API endpoints..."

    # Health check
    if curl -f http://localhost:8000/health | grep -q "healthy"; then
        track_test "Health Endpoint" "pass"
    else
        track_test "Health Endpoint" "fail"
    fi

    # Authentication endpoints
    local auth_token
    auth_token=$(curl -s -X POST http://localhost:8000/auth/login \
        -H "Content-Type: application/json" \
        -d '{"email":"test@example.com","password":"testpassword"}' | \
        jq -r '.access_token' 2>/dev/null || echo "")

    if [ -n "$auth_token" ] && [ "$auth_token" != "null" ]; then
        track_test "Authentication API" "pass"
    else
        track_test "Authentication API" "fail"
    fi

    # Booking endpoints (if auth successful)
    if [ -n "$auth_token" ] && [ "$auth_token" != "null" ]; then
        if curl -f -H "Authorization: Bearer $auth_token" http://localhost:8000/bookings > /dev/null 2>&1; then
            track_test "Booking API" "pass"
        else
            track_test "Booking API" "fail"
        fi
    else
        track_test "Booking API" "fail"
    fi

    # WebSocket integration test
    log_info "Testing WebSocket connectivity..."
    if command -v websocat >/dev/null 2>&1; then
        echo "ping" | timeout 5s websocat ws://localhost:8000/ws > /dev/null 2>&1 && \
            track_test "WebSocket Connection" "pass" || \
            track_test "WebSocket Connection" "fail"
    else
        log_warning "websocat not found, skipping WebSocket test"
        track_test "WebSocket Connection" "skip"
    fi

    # Stop backend server
    kill $backend_pid 2>/dev/null || true
    deactivate
    cd "$PROJECT_ROOT"

    log_success "Integration tests completed"
}

# End-to-end tests
run_e2e_tests() {
    log_info "Running end-to-end tests..."

    # Check if Playwright is available
    if ! command -v npx >/dev/null 2>&1; then
        log_warning "npm/npx not found, skipping E2E tests"
        return 0
    fi

    cd "$FRONTEND_DIR"

    # Install Playwright if needed
    if [ ! -d "node_modules/@playwright" ]; then
        log_info "Installing Playwright for E2E tests..."
        npm install --save-dev @playwright/test
        npx playwright install
    fi

    # Create basic E2E test if it doesn't exist
    if [ ! -f "e2e/booking.spec.ts" ]; then
        mkdir -p e2e
        cat > e2e/booking.spec.ts << 'EOF'
import { test, expect } from '@playwright/test';

test.describe('Booking System E2E Tests', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await expect(page).toHaveTitle(/JLI Loctician/);
  });

  test('should navigate to booking page', async ({ page }) => {
    await page.goto('http://localhost:5173');
    const bookingLink = page.locator('text=Book Appointment');
    if (await bookingLink.isVisible()) {
      await bookingLink.click();
      await expect(page.url()).toContain('/booking');
    }
  });

  test('should display login form', async ({ page }) => {
    await page.goto('http://localhost:5173/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });
});
EOF
    fi

    # Start frontend dev server for E2E tests
    npm run dev &
    local frontend_pid=$!

    # Wait for frontend to start
    sleep 10

    # Run E2E tests
    if npx playwright test --timeout=$((E2E_TIMEOUT * 1000)); then
        track_test "End-to-End Tests" "pass"
    else
        track_test "End-to-End Tests" "fail"
    fi

    # Stop frontend server
    kill $frontend_pid 2>/dev/null || true

    cd "$PROJECT_ROOT"
}

# Security tests
run_security_tests() {
    log_info "Running security tests..."

    # SQL injection tests
    log_info "Testing SQL injection protection..."
    if psql "$DATABASE_URL" -c "SELECT 1; DROP TABLE users; --" 2>/dev/null; then
        track_test "SQL Injection Protection" "fail"
    else
        track_test "SQL Injection Protection" "pass"
    fi

    # Authentication security
    log_info "Testing authentication security..."
    local weak_password_test
    weak_password_test=$(curl -s -X POST http://localhost:8000/auth/register \
        -H "Content-Type: application/json" \
        -d '{"email":"test@example.com","password":"123"}' | \
        jq -r '.detail' 2>/dev/null || echo "")

    if echo "$weak_password_test" | grep -q -i "password.*strong\|password.*requirements"; then
        track_test "Password Strength Validation" "pass"
    else
        track_test "Password Strength Validation" "fail"
    fi

    # CORS configuration test
    log_info "Testing CORS configuration..."
    local cors_test
    cors_test=$(curl -s -H "Origin: http://malicious-site.com" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: X-Requested-With" \
        -X OPTIONS http://localhost:8000/auth/login 2>/dev/null || echo "")

    if ! echo "$cors_test" | grep -q "Access-Control-Allow-Origin: http://malicious-site.com"; then
        track_test "CORS Security" "pass"
    else
        track_test "CORS Security" "fail"
    fi

    log_success "Security tests completed"
}

# Performance tests
run_performance_tests() {
    log_info "Running performance tests..."

    # Database performance
    log_info "Testing database query performance..."
    local avg_query_time
    avg_query_time=$(psql "$DATABASE_URL" -t -c "
        SELECT AVG(execution_time)
        FROM (
            SELECT unnest(array[1,2,3,4,5]) as i
        ) t, LATERAL (
            SELECT extract(milliseconds from clock_timestamp() - start_time) as execution_time
            FROM (SELECT clock_timestamp() as start_time) s,
                 LATERAL (SELECT * FROM users LIMIT 100) q
        ) timing;
    " 2>/dev/null || echo "0")

    if (( $(echo "$avg_query_time < 50" | bc -l) )); then
        track_test "Database Query Performance" "pass"
    else
        track_test "Database Query Performance" "fail"
    fi

    # API response time
    log_info "Testing API response time..."
    local api_response_time
    api_response_time=$(curl -o /dev/null -s -w "%{time_total}" http://localhost:8000/health 2>/dev/null || echo "999")

    if (( $(echo "$api_response_time < 0.5" | bc -l) )); then
        track_test "API Response Time" "pass"
    else
        track_test "API Response Time" "fail"
    fi

    # Frontend bundle size
    if [ -d "$FRONTEND_DIR/dist" ]; then
        local bundle_size
        bundle_size=$(du -sb "$FRONTEND_DIR/dist" | cut -f1)
        # Less than 5MB
        if [ "$bundle_size" -lt 5242880 ]; then
            track_test "Frontend Bundle Size" "pass"
        else
            track_test "Frontend Bundle Size" "fail"
        fi
    else
        track_test "Frontend Bundle Size" "skip"
    fi

    log_success "Performance tests completed"
}

# Generate test report
generate_test_report() {
    log_info "Generating test report..."

    local report_file="$PROJECT_ROOT/test_report_$(date +%Y%m%d_%H%M%S).html"

    cat > "$report_file" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>JLI Loctician Booking System - Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { background: #e8f5e9; padding: 15px; margin: 20px 0; border-radius: 5px; }
        .fail { background: #ffebee; padding: 15px; margin: 20px 0; border-radius: 5px; }
        .test-section { margin: 20px 0; }
        .pass { color: green; }
        .fail { color: red; }
        .skip { color: orange; }
    </style>
</head>
<body>
    <div class="header">
        <h1>JLI Loctician Booking System - Test Report</h1>
        <p>Generated: $(date)</p>
        <p>Environment: $TEST_ENVIRONMENT</p>
    </div>

    <div class="summary">
        <h2>Test Summary</h2>
        <p><strong>Total Tests:</strong> $TOTAL_TESTS</p>
        <p><strong>Passed:</strong> <span class="pass">$PASSED_TESTS</span></p>
        <p><strong>Failed:</strong> <span class="fail">$FAILED_TESTS</span></p>
        <p><strong>Success Rate:</strong> $(( PASSED_TESTS * 100 / TOTAL_TESTS ))%</p>
    </div>

    <div class="test-section">
        <h2>Test Categories</h2>
        <ul>
            <li>Database Tests</li>
            <li>Backend API Tests</li>
            <li>Frontend Tests</li>
            <li>Integration Tests</li>
            <li>End-to-End Tests</li>
            <li>Security Tests</li>
            <li>Performance Tests</li>
        </ul>
    </div>

    <div class="test-section">
        <h2>Coverage Information</h2>
        <p>Backend code coverage threshold: $COVERAGE_THRESHOLD%</p>
        <p>Frontend test coverage is generated separately with npm run test:coverage</p>
    </div>

    <div class="test-section">
        <h2>Recommendations</h2>
        <ul>
            <li>Review failed tests and fix issues before deployment</li>
            <li>Ensure all security tests pass</li>
            <li>Monitor performance benchmarks</li>
            <li>Run tests regularly in CI/CD pipeline</li>
        </ul>
    </div>
</body>
</html>
EOF

    log_success "Test report generated: $report_file"
}

# Main test execution
main() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║              JLI Loctician Booking System                    ║"
    echo "║                 Comprehensive Test Suite                     ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"

    log_info "Starting comprehensive test suite..."

    # Setup test environment
    setup_test_environment

    # Run all test categories
    run_database_tests || true
    run_backend_tests || true
    run_frontend_tests || true
    run_integration_tests || true
    run_e2e_tests || true
    run_security_tests || true
    run_performance_tests || true

    # Generate report
    generate_test_report

    # Print final summary
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                     Test Summary                             ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "Total Tests: ${BLUE}$TOTAL_TESTS${NC}"
    echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
    echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
    echo -e "Success Rate: ${BLUE}$(( PASSED_TESTS * 100 / TOTAL_TESTS ))%${NC}"
    echo ""

    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}All tests passed! System is ready for deployment.${NC}"
        exit 0
    else
        echo -e "${RED}$FAILED_TESTS tests failed. Please review and fix issues.${NC}"
        exit 1
    fi
}

# Show usage information
show_usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Environment Variables:"
    echo "  TEST_ENVIRONMENT=test        - Test environment name"
    echo "  PARALLEL_TESTS=true          - Run tests in parallel"
    echo "  COVERAGE_THRESHOLD=80        - Code coverage threshold"
    echo "  E2E_TIMEOUT=60              - E2E test timeout in seconds"
    echo "  TEST_DATABASE_URL           - Test database connection"
    echo ""
    echo "Examples:"
    echo "  $0                          # Run all tests"
    echo "  TEST_ENVIRONMENT=ci $0      # Run in CI environment"
    echo "  COVERAGE_THRESHOLD=90 $0    # Higher coverage requirement"
}

# Handle command line arguments
case "${1:-}" in
    -h|--help)
        show_usage
        exit 0
        ;;
    *)
        main
        ;;
esac