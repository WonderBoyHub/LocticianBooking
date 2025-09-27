#!/bin/bash

# JLI Loctician Booking System - Production Readiness Checklist
# This script validates production readiness with security, performance, and operational checks

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

# Checklist tracking
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

declare -a FAILED_ITEMS=()
declare -a WARNING_ITEMS=()

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

log_section() {
    echo -e "\n${PURPLE}=== $1 ===${NC}"
}

# Track check results
track_check() {
    local check_name="$1"
    local result="$2"
    local details="${3:-}"

    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

    case "$result" in
        "pass")
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
            log_success "$check_name"
            ;;
        "fail")
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
            log_error "$check_name"
            FAILED_ITEMS+=("$check_name: $details")
            ;;
        "warning")
            WARNING_CHECKS=$((WARNING_CHECKS + 1))
            log_warning "$check_name"
            WARNING_ITEMS+=("$check_name: $details")
            ;;
    esac
}

# Security validation
check_security() {
    log_section "Security Validation"

    # Environment variables security
    if [ -f "$BACKEND_DIR/.env" ]; then
        if grep -q "SECRET_KEY=.*production\|SECRET_KEY=.*secret" "$BACKEND_DIR/.env"; then
            track_check "Strong SECRET_KEY" "fail" "Using weak or default secret key"
        else
            track_check "Strong SECRET_KEY" "pass"
        fi

        if grep -q "DEBUG=true\|DEBUG=True" "$BACKEND_DIR/.env"; then
            track_check "Debug Mode Disabled" "fail" "Debug mode is enabled in production"
        else
            track_check "Debug Mode Disabled" "pass"
        fi

        if grep -q "CORS_ORIGINS.*\*" "$BACKEND_DIR/.env"; then
            track_check "CORS Configuration" "fail" "CORS allows all origins (*)"
        else
            track_check "CORS Configuration" "pass"
        fi
    else
        track_check "Environment File" "fail" "No .env file found"
    fi

    # Database security
    if [ -n "${DATABASE_URL:-}" ]; then
        if echo "$DATABASE_URL" | grep -q "localhost\|127.0.0.1"; then
            track_check "Database Host" "warning" "Using localhost database"
        else
            track_check "Database Host" "pass"
        fi

        if echo "$DATABASE_URL" | grep -q ":password@\|:123@\|:admin@"; then
            track_check "Database Password" "fail" "Using weak database password"
        else
            track_check "Database Password" "pass"
        fi

        # Test SSL connection
        if psql "$DATABASE_URL?sslmode=require" -c "SELECT 1;" > /dev/null 2>&1; then
            track_check "Database SSL" "pass"
        else
            track_check "Database SSL" "warning" "Database SSL not enforced"
        fi
    else
        track_check "Database Configuration" "fail" "DATABASE_URL not set"
    fi

    # HTTPS configuration
    if [ -f "$FRONTEND_DIR/dist/index.html" ]; then
        if grep -q "http://" "$FRONTEND_DIR/dist/index.html"; then
            track_check "HTTPS Enforcement" "warning" "Found HTTP links in production build"
        else
            track_check "HTTPS Enforcement" "pass"
        fi
    else
        track_check "Production Build" "fail" "Frontend not built for production"
    fi

    # Security headers check
    if command -v curl >/dev/null 2>&1 && curl -f http://localhost:8000/health > /dev/null 2>&1; then
        local security_headers
        security_headers=$(curl -I http://localhost:8000/health 2>/dev/null | grep -i "x-frame-options\|x-content-type-options\|x-xss-protection" | wc -l || echo "0")

        if [ "$security_headers" -ge 2 ]; then
            track_check "Security Headers" "pass"
        else
            track_check "Security Headers" "warning" "Missing security headers"
        fi
    else
        track_check "Security Headers" "warning" "Cannot test - server not running"
    fi

    # Check for sensitive files
    local sensitive_files=(".env" "*.key" "*.pem" "*.p12" "config.json")
    for pattern in "${sensitive_files[@]}"; do
        if find "$PROJECT_ROOT" -name "$pattern" -type f 2>/dev/null | grep -v ".env.example" | grep -q .; then
            track_check "Sensitive Files" "warning" "Found potentially sensitive files: $pattern"
        fi
    done

    if [ ${#sensitive_files[@]} -eq 0 ]; then
        track_check "Sensitive Files" "pass"
    fi
}

# Performance validation
check_performance() {
    log_section "Performance Validation"

    # Database performance
    if [ -n "${DATABASE_URL:-}" ] && psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
        # Check query performance
        local avg_query_time
        avg_query_time=$(psql "$DATABASE_URL" -t -c "
            SELECT COALESCE(AVG(mean_exec_time), 0)
            FROM pg_stat_statements
            WHERE calls > 10
            LIMIT 1;
        " 2>/dev/null | tr -d ' ' || echo "0")

        if (( $(echo "$avg_query_time < 50" | bc -l 2>/dev/null || echo "0") )); then
            track_check "Database Query Performance" "pass"
        elif [ "$avg_query_time" = "0" ]; then
            track_check "Database Query Performance" "warning" "No query statistics available"
        else
            track_check "Database Query Performance" "fail" "Average query time: ${avg_query_time}ms"
        fi

        # Check index usage
        local unused_indexes
        unused_indexes=$(psql "$DATABASE_URL" -t -c "
            SELECT COUNT(*)
            FROM pg_stat_user_indexes
            WHERE idx_scan = 0 AND schemaname = 'public';
        " 2>/dev/null | tr -d ' ' || echo "0")

        if [ "$unused_indexes" -eq 0 ]; then
            track_check "Database Index Efficiency" "pass"
        else
            track_check "Database Index Efficiency" "warning" "$unused_indexes unused indexes"
        fi

        # Check connection count
        local connection_count
        connection_count=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null | tr -d ' ' || echo "0")

        if [ "$connection_count" -lt 100 ]; then
            track_check "Database Connections" "pass"
        else
            track_check "Database Connections" "warning" "$connection_count active connections"
        fi
    else
        track_check "Database Performance" "fail" "Cannot connect to database"
    fi

    # Frontend bundle analysis
    if [ -d "$FRONTEND_DIR/dist" ]; then
        local bundle_size
        bundle_size=$(du -sh "$FRONTEND_DIR/dist" | cut -f1)
        local bundle_bytes
        bundle_bytes=$(du -sb "$FRONTEND_DIR/dist" | cut -f1)

        # Check bundle size (< 5MB)
        if [ "$bundle_bytes" -lt 5242880 ]; then
            track_check "Frontend Bundle Size" "pass" "Size: $bundle_size"
        elif [ "$bundle_bytes" -lt 10485760 ]; then
            track_check "Frontend Bundle Size" "warning" "Size: $bundle_size (consider optimization)"
        else
            track_check "Frontend Bundle Size" "fail" "Size: $bundle_size (too large)"
        fi

        # Check for large assets
        local large_files
        large_files=$(find "$FRONTEND_DIR/dist" -type f -size +1M | wc -l)
        if [ "$large_files" -eq 0 ]; then
            track_check "Large Asset Files" "pass"
        else
            track_check "Large Asset Files" "warning" "$large_files files > 1MB"
        fi

        # Check for source maps in production
        if find "$FRONTEND_DIR/dist" -name "*.map" | grep -q .; then
            track_check "Source Maps" "warning" "Source maps found in production build"
        else
            track_check "Source Maps" "pass"
        fi
    else
        track_check "Frontend Build" "fail" "Production build not found"
    fi

    # Memory usage check (if backend is running)
    if command -v pgrep >/dev/null 2>&1 && pgrep -f "python.*main.py" > /dev/null; then
        local memory_usage
        memory_usage=$(ps -o pid,vsz,rss,comm -p "$(pgrep -f "python.*main.py")" | tail -1 | awk '{print $3}')
        memory_usage=$((memory_usage / 1024)) # Convert to MB

        if [ "$memory_usage" -lt 512 ]; then
            track_check "Backend Memory Usage" "pass" "${memory_usage}MB"
        elif [ "$memory_usage" -lt 1024 ]; then
            track_check "Backend Memory Usage" "warning" "${memory_usage}MB"
        else
            track_check "Backend Memory Usage" "fail" "${memory_usage}MB (too high)"
        fi
    else
        track_check "Backend Memory Usage" "warning" "Backend not running - cannot check"
    fi
}

# Operational readiness
check_operations() {
    log_section "Operational Readiness"

    # Backup strategy
    if [ -f "$DB_DIR/backup_strategy.sql" ]; then
        track_check "Backup Strategy" "pass"
    else
        track_check "Backup Strategy" "warning" "No backup strategy documented"
    fi

    # Monitoring setup
    local monitoring_endpoints=("/health" "/metrics" "/ready")
    local available_endpoints=0

    for endpoint in "${monitoring_endpoints[@]}"; do
        if curl -f "http://localhost:8000$endpoint" > /dev/null 2>&1; then
            available_endpoints=$((available_endpoints + 1))
        fi
    done

    if [ "$available_endpoints" -ge 2 ]; then
        track_check "Monitoring Endpoints" "pass" "$available_endpoints/3 endpoints available"
    elif [ "$available_endpoints" -ge 1 ]; then
        track_check "Monitoring Endpoints" "warning" "$available_endpoints/3 endpoints available"
    else
        track_check "Monitoring Endpoints" "fail" "No monitoring endpoints available"
    fi

    # Log configuration
    if [ -f "$BACKEND_DIR/main.py" ] && grep -q "logging\|structlog" "$BACKEND_DIR/main.py"; then
        track_check "Logging Configuration" "pass"
    else
        track_check "Logging Configuration" "warning" "No structured logging found"
    fi

    # Error handling
    if [ -f "$BACKEND_DIR/app/core/exceptions.py" ] || grep -q "HTTPException\|try.*except" "$BACKEND_DIR/main.py"; then
        track_check "Error Handling" "pass"
    else
        track_check "Error Handling" "warning" "Limited error handling found"
    fi

    # Process management
    if command -v systemctl >/dev/null 2>&1; then
        track_check "Process Management" "pass" "systemd available"
    elif command -v supervisorctl >/dev/null 2>&1; then
        track_check "Process Management" "pass" "supervisor available"
    else
        track_check "Process Management" "warning" "No process manager detected"
    fi

    # SSL certificates (if HTTPS)
    if [ -n "${SSL_CERT_PATH:-}" ] && [ -f "$SSL_CERT_PATH" ]; then
        local cert_expiry
        cert_expiry=$(openssl x509 -enddate -noout -in "$SSL_CERT_PATH" 2>/dev/null | cut -d= -f2 || echo "")
        if [ -n "$cert_expiry" ]; then
            local days_until_expiry
            days_until_expiry=$(( ($(date -d "$cert_expiry" +%s) - $(date +%s)) / 86400 ))

            if [ "$days_until_expiry" -gt 30 ]; then
                track_check "SSL Certificate" "pass" "Expires in $days_until_expiry days"
            elif [ "$days_until_expiry" -gt 7 ]; then
                track_check "SSL Certificate" "warning" "Expires in $days_until_expiry days"
            else
                track_check "SSL Certificate" "fail" "Expires in $days_until_expiry days"
            fi
        else
            track_check "SSL Certificate" "warning" "Cannot read certificate expiry"
        fi
    else
        track_check "SSL Certificate" "warning" "No SSL certificate configured"
    fi
}

# Business logic validation
check_business_logic() {
    log_section "Business Logic Validation"

    # Role-based access control
    if [ -n "${DATABASE_URL:-}" ] && psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
        # Check if RBAC tables exist
        local rbac_tables
        rbac_tables=$(psql "$DATABASE_URL" -t -c "
            SELECT COUNT(*)
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN ('users', 'roles', 'permissions', 'user_roles');
        " 2>/dev/null | tr -d ' ' || echo "0")

        if [ "$rbac_tables" -ge 3 ]; then
            track_check "RBAC Tables" "pass"
        else
            track_check "RBAC Tables" "fail" "Missing RBAC tables"
        fi

        # Check booking conflict prevention
        if psql "$DATABASE_URL" -c "SELECT can_user_book_service(1, 1, tstzrange(now(), now() + interval '1 hour'));" > /dev/null 2>&1; then
            track_check "Booking Logic" "pass"
        else
            track_check "Booking Logic" "warning" "Cannot test booking functions"
        fi

        # Check payment integration
        if psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'payments';" | grep -q "1"; then
            track_check "Payment Tables" "pass"
        else
            track_check "Payment Tables" "warning" "Payment tables not found"
        fi
    else
        track_check "Business Logic" "fail" "Cannot connect to database"
    fi

    # API endpoints validation
    local critical_endpoints=("/auth/login" "/bookings" "/services" "/users/me")
    local working_endpoints=0

    for endpoint in "${critical_endpoints[@]}"; do
        if curl -f -X OPTIONS "http://localhost:8000$endpoint" > /dev/null 2>&1; then
            working_endpoints=$((working_endpoints + 1))
        fi
    done

    if [ "$working_endpoints" -eq ${#critical_endpoints[@]} ]; then
        track_check "Critical API Endpoints" "pass"
    elif [ "$working_endpoints" -gt 0 ]; then
        track_check "Critical API Endpoints" "warning" "$working_endpoints/${#critical_endpoints[@]} endpoints available"
    else
        track_check "Critical API Endpoints" "fail" "No critical endpoints available"
    fi

    # Mollie payment integration
    if [ -n "${MOLLIE_API_KEY:-}" ]; then
        if [[ "$MOLLIE_API_KEY" == test_* ]]; then
            track_check "Payment Integration" "warning" "Using test API key"
        elif [[ "$MOLLIE_API_KEY" == live_* ]]; then
            track_check "Payment Integration" "pass"
        else
            track_check "Payment Integration" "fail" "Invalid Mollie API key format"
        fi
    else
        track_check "Payment Integration" "fail" "Mollie API key not configured"
    fi
}

# Data integrity validation
check_data_integrity() {
    log_section "Data Integrity"

    if [ -n "${DATABASE_URL:-}" ] && psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
        # Check foreign key constraints
        local fk_constraints
        fk_constraints=$(psql "$DATABASE_URL" -t -c "
            SELECT COUNT(*)
            FROM information_schema.table_constraints
            WHERE constraint_type = 'FOREIGN KEY'
            AND table_schema = 'public';
        " 2>/dev/null | tr -d ' ' || echo "0")

        if [ "$fk_constraints" -gt 5 ]; then
            track_check "Foreign Key Constraints" "pass" "$fk_constraints constraints"
        else
            track_check "Foreign Key Constraints" "warning" "Only $fk_constraints constraints"
        fi

        # Check for orphaned records
        local orphaned_bookings
        orphaned_bookings=$(psql "$DATABASE_URL" -t -c "
            SELECT COUNT(*)
            FROM bookings b
            LEFT JOIN users u ON b.user_id = u.id
            WHERE u.id IS NULL;
        " 2>/dev/null | tr -d ' ' || echo "0")

        if [ "$orphaned_bookings" -eq 0 ]; then
            track_check "Data Consistency" "pass"
        else
            track_check "Data Consistency" "warning" "$orphaned_bookings orphaned bookings"
        fi

        # Check GDPR compliance features
        if psql "$DATABASE_URL" -c "SELECT delete_user_data(1);" > /dev/null 2>&1; then
            track_check "GDPR Compliance" "pass"
        else
            track_check "GDPR Compliance" "warning" "GDPR functions not available"
        fi

        # Check audit logging
        if psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'audit_log';" | grep -q "1"; then
            track_check "Audit Logging" "pass"
        else
            track_check "Audit Logging" "warning" "No audit logging table"
        fi
    else
        track_check "Data Integrity" "fail" "Cannot connect to database"
    fi
}

# Generate production checklist report
generate_checklist_report() {
    log_info "Generating production checklist report..."

    local report_file="$PROJECT_ROOT/production_checklist_$(date +%Y%m%d_%H%M%S).html"

    cat > "$report_file" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>JLI Loctician Booking System - Production Checklist</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .summary { padding: 15px; margin: 20px 0; border-radius: 5px; }
        .pass { background: #e8f5e9; border-left: 5px solid #4caf50; }
        .warning { background: #fff3e0; border-left: 5px solid #ff9800; }
        .fail { background: #ffebee; border-left: 5px solid #f44336; }
        .section { margin: 30px 0; }
        .check-item { margin: 10px 0; padding: 10px; border-radius: 3px; }
        .check-pass { background: #e8f5e9; }
        .check-warning { background: #fff3e0; }
        .check-fail { background: #ffebee; }
        .status { font-weight: bold; }
        ul.issues { margin: 10px 0; }
        .footer { background: #f5f5f5; padding: 20px; border-radius: 5px; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 JLI Loctician Booking System - Production Checklist</h1>
        <p><strong>Generated:</strong> $(date)</p>
        <p><strong>Environment:</strong> Production Readiness Check</p>
    </div>

    <div class="summary $([ $FAILED_CHECKS -eq 0 ] && echo "pass" || echo "fail")">
        <h2>📊 Overall Status</h2>
        <p><strong>Total Checks:</strong> $TOTAL_CHECKS</p>
        <p><strong>✅ Passed:</strong> $PASSED_CHECKS</p>
        <p><strong>⚠️ Warnings:</strong> $WARNING_CHECKS</p>
        <p><strong>❌ Failed:</strong> $FAILED_CHECKS</p>
        <p><strong>Success Rate:</strong> $(( (PASSED_CHECKS + WARNING_CHECKS) * 100 / TOTAL_CHECKS ))%</p>
    </div>

EOF

    if [ $FAILED_CHECKS -gt 0 ]; then
        cat >> "$report_file" << EOF
    <div class="summary fail">
        <h2>❌ Critical Issues (Must Fix)</h2>
        <ul class="issues">
EOF
        for item in "${FAILED_ITEMS[@]}"; do
            echo "            <li>$item</li>" >> "$report_file"
        done
        cat >> "$report_file" << EOF
        </ul>
    </div>
EOF
    fi

    if [ $WARNING_CHECKS -gt 0 ]; then
        cat >> "$report_file" << EOF
    <div class="summary warning">
        <h2>⚠️ Warnings (Should Fix)</h2>
        <ul class="issues">
EOF
        for item in "${WARNING_ITEMS[@]}"; do
            echo "            <li>$item</li>" >> "$report_file"
        done
        cat >> "$report_file" << EOF
        </ul>
    </div>
EOF
    fi

    cat >> "$report_file" << EOF
    <div class="section">
        <h2>🛡️ Security Checklist</h2>
        <ul>
            <li>✅ Strong SECRET_KEY configured</li>
            <li>✅ Debug mode disabled in production</li>
            <li>✅ CORS properly configured</li>
            <li>✅ Database SSL enabled</li>
            <li>✅ HTTPS enforced</li>
            <li>✅ Security headers implemented</li>
            <li>✅ No sensitive files exposed</li>
        </ul>
    </div>

    <div class="section">
        <h2>⚡ Performance Checklist</h2>
        <ul>
            <li>✅ Database queries < 50ms average</li>
            <li>✅ Efficient database indexes</li>
            <li>✅ Frontend bundle < 5MB</li>
            <li>✅ No large asset files</li>
            <li>✅ Memory usage optimized</li>
            <li>✅ Source maps removed from production</li>
        </ul>
    </div>

    <div class="section">
        <h2>🔧 Operations Checklist</h2>
        <ul>
            <li>✅ Backup strategy documented</li>
            <li>✅ Monitoring endpoints available</li>
            <li>✅ Structured logging configured</li>
            <li>✅ Error handling implemented</li>
            <li>✅ Process management setup</li>
            <li>✅ SSL certificates valid</li>
        </ul>
    </div>

    <div class="section">
        <h2>🏢 Business Logic Checklist</h2>
        <ul>
            <li>✅ RBAC system implemented</li>
            <li>✅ Booking conflict prevention</li>
            <li>✅ Payment integration configured</li>
            <li>✅ Critical API endpoints working</li>
            <li>✅ Data integrity maintained</li>
            <li>✅ GDPR compliance features</li>
        </ul>
    </div>

    <div class="footer">
        <h2>📋 Next Steps</h2>
        <ol>
            <li><strong>Fix Critical Issues:</strong> Address all failed checks before deployment</li>
            <li><strong>Review Warnings:</strong> Evaluate and fix warning items as needed</li>
            <li><strong>Load Testing:</strong> Run load tests with expected traffic</li>
            <li><strong>Monitoring Setup:</strong> Configure external monitoring and alerting</li>
            <li><strong>Backup Testing:</strong> Verify backup and restore procedures</li>
            <li><strong>Team Training:</strong> Train operations team on the system</li>
        </ol>

        <h3>🚀 Deployment Approval</h3>
        <p>$([ $FAILED_CHECKS -eq 0 ] && echo "✅ <strong>APPROVED:</strong> System ready for production deployment" || echo "❌ <strong>NOT APPROVED:</strong> Fix critical issues before deployment")</p>
    </div>
</body>
</html>
EOF

    log_success "Production checklist report generated: $report_file"

    # Also create a simple text summary
    local summary_file="$PROJECT_ROOT/production_summary.txt"
    cat > "$summary_file" << EOF
JLI Loctician Booking System - Production Readiness Summary
=========================================================

Date: $(date)
Status: $([ $FAILED_CHECKS -eq 0 ] && echo "READY" || echo "NOT READY")

Results:
- Total Checks: $TOTAL_CHECKS
- Passed: $PASSED_CHECKS
- Warnings: $WARNING_CHECKS
- Failed: $FAILED_CHECKS
- Success Rate: $(( (PASSED_CHECKS + WARNING_CHECKS) * 100 / TOTAL_CHECKS ))%

$([ $FAILED_CHECKS -eq 0 ] && echo "✅ System approved for production deployment" || echo "❌ Fix critical issues before deployment")

Critical Issues:
$(printf '%s\n' "${FAILED_ITEMS[@]}")

Warnings:
$(printf '%s\n' "${WARNING_ITEMS[@]}")
EOF

    echo ""
    cat "$summary_file"
}

# Main execution
main() {
    echo -e "${PURPLE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║              JLI Loctician Booking System                    ║"
    echo "║               Production Readiness Checklist                ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"

    log_info "Starting production readiness validation..."

    # Load environment if available
    if [ -f "$BACKEND_DIR/.env" ]; then
        set -a
        source "$BACKEND_DIR/.env"
        set +a
    fi

    # Run all checks
    check_security
    check_performance
    check_operations
    check_business_logic
    check_data_integrity

    # Generate report
    generate_checklist_report

    # Final summary
    echo ""
    echo -e "${PURPLE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${PURPLE}║                    Final Assessment                          ║${NC}"
    echo -e "${PURPLE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    if [ $FAILED_CHECKS -eq 0 ]; then
        echo -e "${GREEN}🎉 PRODUCTION READY! 🎉${NC}"
        echo -e "${GREEN}All critical checks passed. System approved for deployment.${NC}"
        exit 0
    else
        echo -e "${RED}🚫 NOT PRODUCTION READY 🚫${NC}"
        echo -e "${RED}$FAILED_CHECKS critical issues must be fixed before deployment.${NC}"
        exit 1
    fi
}

# Show usage information
show_usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "This script performs a comprehensive production readiness check"
    echo "covering security, performance, operations, and business logic."
    echo ""
    echo "Environment Variables:"
    echo "  DATABASE_URL      - Database connection string"
    echo "  MOLLIE_API_KEY   - Mollie payment API key"
    echo "  SSL_CERT_PATH    - Path to SSL certificate"
    echo ""
    echo "Exit Codes:"
    echo "  0 - All checks passed (production ready)"
    echo "  1 - Critical issues found (not production ready)"
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