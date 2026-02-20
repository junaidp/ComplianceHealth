# PDPL Compliance Health — KSA Healthcare Sector

AI-enabled, multi-tenant web application for **Personal Data Protection Law (PDPL)** compliance in the Kingdom of Saudi Arabia healthcare sector. Covers PDPL, NCA ECC, and MoH Data Governance controls (119 total).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript, Vite, Tailwind CSS v4, Zustand, React Router |
| Backend | Express 5 + TypeScript, Prisma ORM v5, JWT auth |
| Database | PostgreSQL |
| AI | OpenAI GPT-4o (remediation guidance, document analysis, chatbot, policy templates) |

## Prerequisites

- **Node.js** ≥ 18
- **PostgreSQL** database (local or hosted, e.g. Supabase, Neon, Railway)
- **OpenAI API key**

## Quick Start

### 1. Clone & install dependencies

```bash
# Frontend
npm install

# Backend
cd server && npm install
```

### 2. Configure environment

Edit `server/.env`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB_NAME?schema=public"
JWT_SECRET="change-me-to-a-strong-random-string"
JWT_REFRESH_SECRET="change-me-to-another-strong-random-string"
OPENAI_API_KEY="sk-..."
PORT=3001
NODE_ENV=development
CORS_ORIGIN="http://localhost:5173"
```

### 3. Set up the database

```bash
cd server

# Generate Prisma client
npm run db:generate

# Push schema to database (creates all tables)
npm run db:push

# Seed with 119 controls, training modules, and demo org/users
npm run db:seed
```

**Demo accounts after seeding:**
| Email | Password | Role |
|-------|----------|------|
| admin@demo-health.sa | Password123! | ORG_ADMIN |
| dpo@demo-health.sa | Password123! | DPO |

### 4. Run development servers

```bash
# Terminal 1 — Backend (port 3001)
cd server && npm run dev

# Terminal 2 — Frontend (port 5173)
npm run dev
```

Open **http://localhost:5173** in your browser.

## Project Structure

```
├── src/                    # React frontend
│   ├── components/         # Layout, ProtectedRoute
│   ├── lib/                # API client (Axios + JWT interceptors)
│   ├── pages/              # All application pages
│   └── stores/             # Zustand auth store
├── server/                 # Express backend
│   ├── prisma/             # Schema & migrations
│   ├── src/
│   │   ├── middleware/      # JWT auth + RBAC
│   │   ├── routes/          # All API endpoints
│   │   ├── services/        # AI, scoring, branching rules
│   │   ├── seeds/           # 119 controls + training modules
│   │   └── utils/           # Audit logger
│   └── uploads/             # Evidence file storage
└── dist/                   # Frontend build output
```

## Modules

- **Dashboard** — Compliance score, gap breakdown, KPIs
- **Assessment Wizard** — Answer 119 controls by domain, auto-scoring
- **Remediation Tracker** — Task management with status workflow + AI guidance
- **Controls Library** — Browse all PDPL / NCA ECC / MoH controls
- **Evidence Vault** — Upload files with SHA-256 hashing
- **Training Portal** — Gap-driven modules with quizzes, pass/fail tracking
- **Reports** — Download compliance reports (PDF/XLSX)
- **Audit Log** — Immutable, append-only activity trail
- **AI Assistant** — Q&A chatbot, document analyzer, policy template generator
- **Settings** — Language toggle (EN/AR RTL), profile view

## Production Deployment

```bash
# Build frontend
npm run build          # outputs to dist/

# Build backend
cd server && npm run build  # outputs to server/dist/

# Start backend in production
cd server && NODE_ENV=production node dist/index.js
```

Serve the frontend `dist/` folder via any static host (Vercel, Netlify, Nginx) with API proxy to the backend.

## Security Notes

- JWT tokens: 1h access / 7d refresh
- Passwords hashed with bcryptjs
- Audit log is append-only (no UPDATE/DELETE)
- Evidence files verified with SHA-256
- CORS restricted to configured origin
- File uploads limited to 50MB, allowed types: PDF, DOCX, XLSX, PNG, JPG, JPEG, EML, TXT, CSV, LOG
