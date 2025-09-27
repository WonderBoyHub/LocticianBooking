# Production Deployment Guide · JLI Booking Platform

This document walks through deploying the PostgreSQL database and connecting the JLI Loctician backend/frontend for production. It consolidates the automated deployment script, individual migrations, security hardening, and ongoing maintenance practices.

---

## 1. Pre-Flight Requirements

- **PostgreSQL** 15 or newer (automations tested against 17)
- Ability to install extensions: `uuid-ossp`, `pgcrypto`, `pg_trgm`, `btree_gist`, `pg_stat_statements`
- Shell access to the target host with superuser or role-management privileges
- Dedicated service account credentials for the application
- Storage for logical backups and optional WAL archiving

Recommended server baseline: 2 vCPU, 4 GB RAM, SSD storage, Ubuntu 20.04+ (or equivalent).

---

## 2. Prepare the Database Host

### 2.1 Install PostgreSQL (Ubuntu example)
```bash
sudo apt update
sudo apt install postgresql-15 postgresql-client-15 postgresql-contrib-15
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

### 2.2 Tune `postgresql.conf`
Adjust values to match your hardware; example starting point:
```conf
shared_buffers = 25%RAM
work_mem = 4MB
maintenance_work_mem = 256MB
max_connections = 200
checkpoint_timeout = 10min
max_wal_size = 1GB
random_page_cost = 1.1
wal_level = replica
archive_mode = on
archive_command = 'rsync -a %p /var/lib/postgresql/wal_archive/%f'
shared_preload_libraries = 'pg_stat_statements'
log_min_duration_statement = 500
log_checkpoints = on
log_connections = on
log_lock_waits = on
```
Reload PostgreSQL after edits (`sudo systemctl restart postgresql`).

### 2.3 Configure Access (`pg_hba.conf`)
```conf
# Local application access
local   loctician_booking    loctician_app          md5
host    loctician_booking    loctician_app 127.0.0.1/32 md5
host    loctician_booking    loctician_app ::1/128    md5
```
Add additional network rules as needed (VPN, VPC CIDR). Reload or restart PostgreSQL to apply.

### 2.4 TLS (Optional but Recommended)
Generate a server certificate/key pair and enable SSL:
```bash
sudo openssl req -new -x509 -days 365 -nodes -text \
  -out /etc/postgresql/server.crt \
  -keyout /etc/postgresql/server.key -subj "/CN=db.justloccit.dk"
sudo chmod 600 /etc/postgresql/server.key
```
Update `postgresql.conf`:
```conf
ssl = on
ssl_cert_file = 'server.crt'
ssl_key_file = 'server.key'
```

---

## 3. Deploy the Database Schema

The SQL assets live in `src/db/`.

### 3.1 Option A: Automated Deployment Script
Run `deploy_booking_system.sql` as a superuser on the target cluster. It validates prerequisites, executes migrations in order, seeds data, and applies performance tooling.
```bash
psql -h <db_host> -U postgres \
  -v db_name=loctician_booking \
  -f src/db/deploy_booking_system.sql
```
The script logs each step via `RAISE NOTICE`. Confirm it ends with a `COMMIT` statement. On failure, it will `ROLLBACK` and describe the failing section.

### 3.2 Option B: Manual Migration Sequence
If you prefer explicit control, run the numbered migrations sequentially:
```bash
for file in src/db/00*.sql src/db/010_create_payment_tables.sql src/db/011_create_fraud_gdpr_tables.sql; do
  psql -h <db_host> -U postgres -d loctician_booking -f "$file"
done
```
This order ensures core tables, payments, maintenance routines, and fraud/GDPR tooling are in place. Review console output for errors before proceeding.

### 3.3 Post-Deployment Checks
```sql
-- Confirm required extensions
SELECT extname FROM pg_extension WHERE extname IN
  ('uuid-ossp','pgcrypto','pg_trgm','btree_gist','pg_stat_statements');

-- Inspect key tables
\dt public.users
\dt public.bookings
\dt public.subscription_plans

-- Validate helper functions
SELECT version(), analyze_query_performance() LIMIT 1;
SELECT database_health_check();
```
Verify that seed data exists, including roles (`admin`, `staff`, `customer`) and the default admin account (`admin@company.com` / `AdminPass123!`). Change seeded credentials immediately after testing.

---

## 4. Create Application Roles & Secrets

1. **Service Role (read/write)**
   ```sql
   CREATE USER loctician_app WITH PASSWORD 'generate-strong-secret';
   GRANT CONNECT ON DATABASE loctician_booking TO loctician_app;
   GRANT USAGE ON SCHEMA public TO loctician_app;
   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO loctician_app;
   GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO loctician_app;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO loctician_app;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO loctician_app;
   ```
2. **Read-Only Role (analytics/reporting)**
   ```sql
   CREATE USER loctician_reporting WITH PASSWORD 'another-secret';
   GRANT CONNECT ON DATABASE loctician_booking TO loctician_reporting;
   GRANT USAGE ON SCHEMA public TO loctician_reporting;
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO loctician_reporting;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO loctician_reporting;
   ```
3. Record the generated passwords securely (e.g., secret manager). Update the backend `.env` with the service role credentials.

---

## 5. Application Configuration (Production)

### Backend (`src/backend/.env`)
```env
DATABASE_URL=postgresql+asyncpg://loctician_app:***@db.justloccit.dk:5432/loctician_booking
SECRET_KEY=<32+ char random>
JWT_SECRET_KEY=<32+ char random>
ENVIRONMENT=production
DEBUG=false
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=<sendgrid-key>
CORS_ORIGINS=["https://app.justloccit.dk"]
```
Regenerate secrets with `python -c "import secrets; print(secrets.token_urlsafe(32))"`.

### Frontend (`src/frontend/.env.production`)
```env
VITE_API_BASE_URL=https://api.justloccit.dk
VITE_WS_URL=wss://api.justloccit.dk/ws
VITE_ENVIRONMENT=production
```
Deploy the frontend with your hosting provider (Vercel, Netlify, S3/CloudFront, etc.) and point DNS records accordingly.

---

## 6. Maintenance & Monitoring

Schedule the built-in routines provided by the migrations:
```cron
# Example crontab for postgres user (UTC)
0 2 * * * psql -d loctician_booking -c "SELECT perform_table_maintenance();" >> /var/log/postgresql/maintenance.log 2>&1
*/15 * * * * psql -d loctician_booking -c "SELECT collect_performance_metrics();" >> /var/log/postgresql/metrics.log 2>&1
0 * * * * psql -d loctician_booking -c "SELECT refresh_analytics_views();" >> /var/log/postgresql/analytics.log 2>&1
0 3 * * * psql -d loctician_booking -c "SELECT gdpr_cleanup_job();" >> /var/log/postgresql/gdpr.log 2>&1
```
Hook the FastAPI application logs and PostgreSQL logs into your observability stack (CloudWatch, ELK, Grafana Loki, etc.).

Key health queries:
```sql
SELECT * FROM database_health_check();
SELECT * FROM v_system_metrics ORDER BY collected_at DESC LIMIT 10;
SELECT * FROM analyze_query_performance() WHERE performance_grade NOT IN ('A','B');
```

---

## 7. Backup & Recovery

1. **Logical backups**
   ```bash
   pg_dump -Fc -v --no-owner --no-privileges \
     -h db.justloccit.dk -U postgres loctician_booking \
     > /backups/loctician_$(date +%Y%m%d).dump
   ```
   Rotate daily/weekly/monthly copies, store off-site, and encrypt at rest.

2. **WAL archiving**: Retain WAL files in a durable location to support point-in-time recovery.

3. **Test restores** quarterly:
   ```bash
   createdb loctician_restore
   pg_restore -h localhost -U postgres -d loctician_restore /backups/loctician_latest.dump
   ```
   Run sanity checks (`SELECT COUNT(*) FROM users;`, `SELECT COUNT(*) FROM bookings;`).

---

## 8. Performance Validation

After connecting the production application, capture baseline metrics:
```sql
SELECT * FROM v_booking_dashboard LIMIT 10;
SELECT * FROM v_staff_utilization ORDER BY utilization_percentage DESC;
SELECT * FROM analyze_query_performance();
SELECT * FROM identify_slow_queries(500, 10);
```
Targets:
- Availability lookups < 50 ms
- Booking creation < 200 ms
- Cache hit ratio > 95%
- No queries graded `D` or `F` in `analyze_query_performance()` under normal load

Use PgBouncer (transaction pooling mode) if connection spikes exceed PostgreSQL limits.

---

## 9. Security Checklist

- [ ] PostgreSQL patched to latest minor release
- [ ] All default passwords rotated (`admin@company.com`, seeded accounts, service roles)
- [ ] TLS enabled between application and database
- [ ] Firewall or security group restricts database access to application hosts/VPN
- [ ] Row Level Security (RLS) policies verified with `ALTER ROLE ... SET` tests
- [ ] Audit and metrics logs shipped to secure storage
- [ ] Backups encrypted and restoration procedure documented
- [ ] GDPR automation functions scheduled and reviewed monthly

---

## 10. Handover Notes

- Keep `src/db/` under version control; create new migration files for schema changes.
- Run migrations in staging before production, validating `database_health_check()` output.
- Document any manual alterations (e.g., additional indexes) so they can be recreated after disaster recovery.
- Coordinate production releases with a maintenance window if migrations alter large tables.

With these steps complete, the JLI booking stack is ready for a secure, observable, and resilient production rollout.
