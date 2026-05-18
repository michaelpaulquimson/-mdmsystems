# MDM Systems — Admin App

A full-stack MDM-style admin application built as a practical tech exam.

## What it does

- **CRUD** for Organizations, Teams, Users, Roles, and Content items.
- **Role-based access control**: `Viewer` (read-only content) and `Editor` (full content CRUD), enforced server-side.
- **Admin panel**: admins can manage all entities and view the full audit trail.
- **React Native bonus** (Phase 2): a single screen showing content assigned to a specific user.

## Stack

| Layer    | Technology                                    |
| -------- | --------------------------------------------- |
| Frontend | React 18 · Vite · Tailwind CSS · shadcn/ui    |
| Backend  | Node 22 · Express · TypeScript · `pg` raw SQL |
| Database | PostgreSQL 16                                 |
| Auth     | JWT (access 15 min) + rotating refresh tokens |
| Docs     | OpenAPI 3.1 · Swagger UI · Postman collection |

## Prerequisites

- Docker + Docker Compose
- Node 22+ (only needed if running workspaces outside Docker; use `.nvmrc` — `nvm use`)

## Quickstart

```bash
cp .env.example .env
make up
```

Then open:

- **Admin UI** → http://localhost:5173
- **API Docs (Swagger UI)** → http://localhost:4000/api/v1/docs
- **Health check** → http://localhost:4000/health/ready

## Default credentials

| User               | Password      | Role   |
| ------------------ | ------------- | ------ |
| `admin@mdm.local`  | `admin123`    | Admin  |
| `viewer@mdm.local` | `password123` | Viewer |
| `editor@mdm.local` | `password123` | Editor |

## All make targets

```
make help        List all targets
make up          Start all services
make down        Stop all services
make logs        Tail backend + frontend logs
make migrate     Run pending DB migrations
make seed        Run the Node seeder
make reset-db    Drop + recreate dev DB (destructive)
make test        Unit + component tests (no DB)
make test-int    Integration tests (spins up test DB)
make e2e         Playwright golden-path spec
make audit       npm audit --audit-level=high
make typecheck   tsc --noEmit across workspaces
make lint        ESLint across workspaces
make clean       Remove node_modules / dist / coverage
```

## Architecture

```
Browser / Mobile
      │  JWT Bearer
      ▼
  Frontend (React · :5173)
      │  axios → http://localhost:4000
      ▼
  Backend (Express · :4000)
   ├─ routes → middleware → controller
   │           └─ auth · permission · validate
   ├─ service  (business logic + org-scoping)
   └─ repository (SQL only) → pg.Pool
                                   │
                              PostgreSQL :5432
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for diagrams, request-flow detail, and module-boundary rules.

## API tour (curl)

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:4000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@mdm.local","password":"admin123"}' | jq -r .accessToken)

# List organisations
curl -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/v1/organizations

# Create a content item
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Hello","body":"World"}' \
  http://localhost:4000/api/v1/content

# Fetch content assigned to a user (React Native bonus endpoint)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/v1/content/assigned/<userId>
```

## Postman

Import `postman_collection.json`. The Login request captures the JWT automatically — every other request uses it. Variables: `{{baseUrl}}` and `{{token}}`.

## Running tests

```bash
make test        # unit + component (fast, no DB)
make test-int    # integration (real Postgres via Docker)
make e2e         # Playwright end-to-end
```

## Security

See [`docs/SECURITY.md`](docs/SECURITY.md) for the OWASP Top 10 mapping and mitigations.

## Architecture decisions

See [`docs/decisions/`](docs/decisions/) for ADRs explaining every major technology choice.

## Phase 2 — React Native (Expo)

The `mobile/` workspace is a complete Expo app that reuses `@mdm/shared` and the same backend.

**Screens:**

- **Login** — authenticates with the same backend; access token stored in Zustand memory, refresh token in `expo-secure-store`
- **Assigned Content** — calls `GET /api/v1/content/assigned/:userId`; renders a `FlatList`; profile card shows name · role · team · org

**Run locally:**

```bash
cd mobile
npm install
npx expo start   # scan QR with Expo Go or run on simulator
```

Set `EXPO_PUBLIC_API_URL=http://<your-machine-ip>:4000/api/v1` in `mobile/.env` (simulator uses your host IP, not `localhost`).
