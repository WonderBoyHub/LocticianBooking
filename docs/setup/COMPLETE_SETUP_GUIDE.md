# Complete Setup Guide · JLI Loctician Booking System

This guide covers everything you need to stand up the full stack locally and get production-ready. Follow the quick start if you just need the app running fast, or continue with the detailed sections for a fully tuned environment.

---

## Quick Start (≈5 minutes)

1. **Create database and load schema**
   ```bash
   createdb loctician_booking
   psql loctician_booking < src/db/schema.sql
   psql loctician_booking < src/db/security_enhancements.sql
   ```
2. **Start backend**
   ```bash
   cd src/backend
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   cp .env.example .env   # update credentials & secrets
   python start.py
   ```
3. **Start frontend**
   ```bash
   cd src/frontend
   npm install
   cp .env.example .env.local
   npm run dev
   ```
4. **Visit the app**: API docs at http://localhost:8000/docs, frontend at http://localhost:3000.

---

## Environment Checklist

- **PostgreSQL** 15+ running locally
- **Python** 3.9 or newer with virtualenv support
- **Node.js** 18+ (or latest LTS) plus npm
- **Git** for version control
- **Optional**: PgAdmin, TablePlus, or another GUI client for database inspection

Project paths referenced in this guide assume the repository root is `/Users/kevinsamuel/Documents/jsreact/jli`.

---

## 1. Database Setup

### 1.1 Create Roles and Database
```bash
psql -U postgres <<'SQL'
CREATE DATABASE loctician_booking;
CREATE USER loctician_user WITH PASSWORD 'replace_with_strong_password';
GRANT ALL PRIVILEGES ON DATABASE loctician_booking TO loctician_user;
SQL
```

### 1.2 Load Schema and Seed Data
```bash
# From the repository root
psql -U loctician_user -d loctician_booking -f src/db/schema.sql
psql -U loctician_user -d loctician_booking -f src/db/security_enhancements.sql
# Optional development sample data
psql -U loctician_user -d loctician_booking -f src/db/sample_data.sql
```

### 1.3 Verify Tables
```bash
psql -U loctician_user -d loctician_booking -c '\dt'
```
You should see tables such as `users`, `services`, `bookings`, `availability_patterns`, and supporting reference tables.

### 1.4 Recommended Extensions
Enable extensions that improve query speed and search:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

---

## 2. Backend Setup (FastAPI)

### 2.1 Virtual Environment & Dependencies
```bash
cd src/backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 2.2 Environment Variables (`src/backend/.env`)
```bash
cp .env.example .env
```
Update the copied file with your database credentials and application secrets:
```env
DATABASE_URL=postgresql+asyncpg://loctician_user:replace_with_strong_password@localhost:5432/loctician_booking
SECRET_KEY=generate-32-char-secret
JWT_SECRET_KEY=generate-another-secret
ENVIRONMENT=development
DEBUG=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASSWORD=app-password-or-token
CORS_ORIGINS=["http://localhost:3000"]
```
Generate secure secrets with:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 2.3 Run the API Server
```bash
python start.py
# or
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Health check**: http://localhost:8000/health should return `{"status": "healthy"}`.

---

## 3. Frontend Setup (React + Vite)

### 3.1 Install Dependencies
```bash
cd src/frontend
npm install
# yarn install   # optional alternative
```

### 3.2 Environment Variables (`src/frontend/.env.local`)
```bash
cp .env.example .env.local
```
Recommended development values:
```env
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws
VITE_ENVIRONMENT=development
```

### 3.3 Run the Dev Server
```bash
npm run dev
# yarn dev   # optional alternative
```
Visit http://localhost:3000 to confirm the booking portal loads.

---

## 4. First-Time Application Configuration

### 4.1 Seed an Admin User
Use the public registration endpoint or create directly via API:
```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@justloccit.dk",
    "password": "ReplaceWithSecurePassword123!",
    "first_name": "Admin",
    "last_name": "User",
    "role": "admin"
  }'
```

### 4.2 Configure Services and Availability
1. Sign in as the admin/loctician user.
2. Navigate to **Services** and add offerings (duration, price, descriptions).
3. Open the **Calendar** and create weekly availability patterns (example: Mon/Tue/Thu/Fri 09:00-17:00, Sat 10:00-16:00).

### 4.3 Test Customer Booking Flow
1. Register a customer account (use a second browser or private window).
2. Book a service and confirm the email notification if SMTP is configured.
3. Switch back to the loctician dashboard to verify the booking appears in calendars and analytics.

---

## 5. Production Preparation

- **Email**: Replace SMTP values with your production provider. Consider transactional services such as SendGrid or Postmark.
- **Secrets**: Regenerate `SECRET_KEY` and `JWT_SECRET_KEY`, set `ENVIRONMENT=production`, and `DEBUG=false`.
- **Frontend URLs**: Update `.env.local` with your deployed API domain, e.g. `https://api.justloccit.dk` and `wss://api.justloccit.dk/ws`.
- **Certificates**: Use HTTPS (LetsEncrypt or similar) for both the frontend and backend.
- **Monitoring**: Configure uptime monitoring and log aggregation (e.g. Health endpoint, FastAPI logs, PostgreSQL logs).

---

## 6. Troubleshooting

- **Database connection refused**: Verify PostgreSQL is running (`pg_isready`) and that the credentials in `.env` are correct.
- **Backend import errors**: Re-activate the virtual environment and reinstall requirements.
- **Frontend blank page**: Clear caches (`rm -rf node_modules package-lock.json && npm install`) and confirm `VITE_API_BASE_URL` is reachable.
- **Migrations/schema drift**: Re-run the files in `src/db/` against the target database and check for errors in the psql output.

---

## 7. Useful Commands Recap

```bash
# Stop and restart FastAPI with reload
deactivate  # exit venv when needed
source venv/bin/activate
uvicorn main:app --reload

# Run backend tests (if defined)
pytest

# Reset local database (destructive!)
dropdb loctician_booking
createdb loctician_booking
psql loctician_booking < src/db/schema.sql
```

---

## Appendix A · Installing PostgreSQL on macOS (Apple Silicon)

1. **Install Homebrew** (if necessary):
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
2. **Install PostgreSQL 15**:
   ```bash
   brew install postgresql@15
   brew services start postgresql@15
   ```
3. **Connect**:
   ```bash
   psql postgres
   ```
   You should see the `postgres=#` prompt.

Alternative: download the PostgreSQL App from https://postgresapp.com/ and click **Start** to launch the server.

If `psql` is missing after installation, add Homebrew binaries to your shell:
```bash
echo 'export PATH="/opt/homebrew/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

---

With the stack running locally and the admin user created, you are ready to tailor services, pricing, and branding for your loctician business.
