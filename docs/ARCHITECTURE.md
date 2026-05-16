# Architecture — MDM Systems

## Overview

MDM Systems is a full-stack admin application built as an **npm-workspaces monorepo** with three runnable services and one shared package.

```
mdmsystems/
├── shared/    @mdm/shared — zod schemas, types, Permissions, ErrorCode (single source of truth)
├── backend/   Node 22 + Express + TypeScript REST API — port 4000
├── frontend/  React 18 + Vite + Tailwind + shadcn/ui — port 5173
├── e2e/       Playwright golden-path tests
└── mobile/    Phase 2 (Expo — not yet built)
```

---

## Service Topology

```
Browser (5173)
    │  REST/JSON
    ▼
React (Vite)
    │  HTTP/REST  Authorization: Bearer <jwt>
    ▼
Express API (4000)
    │  pg driver / raw SQL
    ▼
PostgreSQL 16 (5432)
```

All three services run in Docker containers on a shared internal network. The browser talks to the backend directly (not through a Docker proxy) on port 4000.

---

## Backend Request Flow

```
HTTP request
  → Helmet (security headers)
  → CORS (origin allowlist)
  → express.json() (100 KB body cap)
  → compression (gzip)
  → pinoHttp (request logging + x-request-id)
  → global rate limiter (100 req/min/IP)
  → router /api/v1/...
      → authRequired (JWT verify → req.user)
      → requireAdmin | requirePermission(Permissions.X)
      → validate(ZodSchema) (request body)
      → controller (HTTP shell — no business logic)
          → service (business rules + org-scoping)
              → repository (SQL only)
                  → pg.Pool → Postgres
  → notFoundMiddleware (404)
  → errorMiddleware (typed error → JSON envelope)
```

**Layering rules (never violated):**

- SQL lives only in `**/repositories/*.ts`. Controllers and services never write SQL.
- Controllers are HTTP shells — no try/catch, no business logic. They call one service method and return the result.
- Services take repositories via constructor injection. They never `import pool` directly.
- The composition root (`src/composition-root.ts`) is the only place that `new`s repositories, services, and controllers.

---

## Module Map

Each module lives in `backend/src/modules/<entity>/` and owns all of its layers:

```
modules/
├── auth/           POST /auth/login, /auth/refresh, /auth/logout, GET /auth/me
├── organizations/  CRUD — admin only
├── teams/          CRUD — admin only
├── users/          CRUD — admin only
├── roles/          CRUD — admin only
├── content/        CRUD — permission-gated (content:read/create/update/delete)
└── audit/          GET /audit — admin only, read-only
```

Every module follows the same file shape:

```
<entity>.repository.ts   — IRepository interface + concrete SQL implementation
<entity>.service.ts      — IService interface + business logic
<entity>.controller.ts   — thin HTTP adapter (no logic)
<entity>.routes.ts       — Express Router + OpenAPI registration
index.ts                 — public barrel (service interface + routes builder only)
tests/
  <entity>.service.test.ts   — unit (fake repo via interface)
  <entity>.routes.test.ts    — integration (supertest + real test DB)
```

---

## Shared Package (`@mdm/shared`)

Single source of truth imported by backend, frontend, and (eventually) mobile:

| Export                                                            | Used by                                                    |
| ----------------------------------------------------------------- | ---------------------------------------------------------- |
| Zod schemas (`OrganizationSchema`, `CreateOrganizationSchema`, …) | Backend `validate()` middleware + frontend `zodResolver`   |
| Inferred TS types (`Organization`, `CreateOrganizationInput`, …)  | Backend services/repos + frontend hooks/components         |
| `Permissions` constants (`CONTENT_READ`, `CONTENT_CREATE`, …)     | Backend `requirePermission()` + frontend `<Gate>`          |
| `ErrorCode` enum                                                  | Backend error classes + frontend error handling            |
| `Paginated<T>`, `ListFilters`                                     | Backend service signatures + frontend TanStack Query hooks |

Schema drift between backend and frontend is structurally impossible — both compile from the same zod definitions.

---

## Data Model

```
organizations ──< teams ──< users >── roles
                              │
                              └──< content_items (assigned_to_user_id)
                                    content_items (created_by_user_id)

audit_log (actor_user_id → users, organization_id → organizations)
refresh_tokens (user_id → users)
```

**Key design decisions:**

- UUID PKs (`gen_random_uuid()` from `pgcrypto`)
- `timestamptz` for all timestamps, UTC on the backend
- `roles.permissions` is a JSONB array of permission strings
- `content_items.organization_id NOT NULL` — content always belongs to an org
- `ON DELETE CASCADE` on org → teams, org → content; `ON DELETE SET NULL` elsewhere
- `UNIQUE (name, organization_id)` on teams; `UNIQUE name` on organizations
- `LOWER(email)` unique index defends against case-variant duplicates

---

## Auth Model

### Access tokens

- JWT, signed `HS256` with `JWT_SECRET`
- 15-minute expiry
- Carried in `Authorization: Bearer` header (never cookies — structurally immune to CSRF)
- Payload: `{ sub: userId, email, name, isAdmin, organizationId, teamId, roleId, permissions }`

### Refresh tokens

- Opaque 32-byte random string (base64url)
- 30-day expiry
- Stored **hashed** (`sha-256`) in `refresh_tokens` — raw value never persisted
- **Rotated** on every `/auth/refresh` call (old token revoked, new pair issued)
- **Reuse detection**: if a spent (replaced) token is presented, all tokens in the chain for that user are revoked — the user must re-login

### RBAC

- `users.is_admin = true` bypasses all permission checks
- For non-admins: `roles.permissions` JSONB array checked per route
- Permissions: `content:read`, `content:create`, `content:update`, `content:delete`
- Admin-only routes: all CRUD on organizations, teams, users, roles, and the audit log

---

## Audit Log

Every mutating service method writes an `audit_log` row **inside the same `withTransaction`** as the mutation. Audit and data commit together or roll back together.

```
audit_log
├── actor_user_id   — who performed the action
├── action          — 'create' | 'update' | 'delete' | 'login' | 'logout'
├── entity_type     — 'organization' | 'team' | 'user' | 'role' | 'content_item'
├── entity_id       — the affected row's UUID
├── organization_id — the org context (null for org-delete events)
├── before / after  — JSONB snapshots of the row before and after
├── ip_address      — from req.ip
└── occurred_at     — timestamptz
```

Audit rows are append-only by application convention. There is no DELETE route for audit entries.

---

## Frontend Architecture

State management follows three non-overlapping tiers:

| Tier                         | Tool           | What lives here                                          |
| ---------------------------- | -------------- | -------------------------------------------------------- |
| Server state                 | TanStack Query | All API data — cached, refetched, invalidated per entity |
| Cross-component client state | Zustand        | Auth (user + token), UI flags (sidebar, toasts)          |
| Local UI state               | `useState`     | Form drafts, modal open/closed, hover states             |

**Auth flow:**

1. `<AuthBootstrap>` runs once at app root — reads persisted token from `localStorage`, calls `/auth/me` to validate, hydrates `useAuthStore` or clears on 401.
2. Axios interceptor attaches `Authorization: Bearer` to every request. On 401, calls `/auth/refresh` once (de-duped across concurrent requests), retries the original request, or clears auth store and redirects to `/login`.
3. `<ProtectedRoute>` wraps all authenticated pages. `<Gate permission={Permissions.X}>` hides UI affordances for users who lack a permission.

**Feature folder shape (Bulletproof React style):**

```
features/<entity>/
├── api/<entity>.api.ts          — 5 axios calls (list/get/create/update/delete)
├── hooks/use-<entity>s.ts       — TanStack Query hooks per operation
├── components/
│   ├── <entity>s-table.tsx
│   └── <entity>-form-dialog.tsx
└── pages/<entity>s-page.tsx     — thin container: fetch → render table/dialog
```

---

## Composition Root

`backend/src/composition-root.ts` is the single wiring point. It:

1. Instantiates all repositories (injecting `pg.Pool`)
2. Instantiates all services (injecting their repository dependencies)
3. Instantiates all controllers (injecting their service dependencies)
4. Builds the Express `Router` and mounts all sub-routers
5. Returns `{ router, metricsHandler, healthReadyHandler }` to `index.ts`

Nothing outside this file calls `new` on a repository, service, or controller. This makes the entire dependency graph greppable in one place and makes unit testing trivial (swap the concrete repo for a fake that implements the same interface).

---

## Observability

| Signal          | Implementation                                                                      |
| --------------- | ----------------------------------------------------------------------------------- |
| Structured logs | `pino` + `pino-http`; JSON in prod, pretty-print in dev                             |
| Request tracing | `x-request-id` UUID on every response; correlated in every log line                 |
| Metrics         | `prom-client` at `GET /metrics` — process metrics + HTTP histogram + pg.Pool gauges |
| Audit trail     | `audit_log` table — every mutation logged with before/after JSONB                   |
| Health          | `GET /health` (liveness) + `GET /health/ready` (DB ping + migration count)          |

**Redaction**: `pino` is configured to redact `req.headers.authorization`, `password`, `password_hash`, and `token` from all log output.

---

## API Conventions

- All business routes under `/api/v1/…` (versioned from day one)
- List endpoints always return `{ data: T[], pagination: { total, limit, offset } }` — pagination is never added as a breaking change
- Partial updates use `PATCH` (never PUT)
- Error envelope: `{ error: { code: ErrorCode, message: string, details? } }`
- ISO 8601 datetimes in/out everywhere
- No trailing slashes on routes

---

## Technology Decisions Summary

| Decision         | Chosen                            | Why                                                                   |
| ---------------- | --------------------------------- | --------------------------------------------------------------------- |
| DB driver        | `pg` raw SQL                      | Repository pattern shines with real SQL; no ORM hides query craft     |
| Module layout    | Feature-based                     | One folder per bounded context; open one module, know them all        |
| State (server)   | TanStack Query                    | Better cache semantics than Redux; replaces 80 % of Redux use cases   |
| State (client)   | Zustand slice-per-store           | New cross-component state = new store file, never a refactor          |
| Auth transport   | JWT in Authorization header       | Stateless; identical for React Native; immune to CSRF                 |
| Update semantics | PATCH (partial)                   | Correct per HTTP spec; PUT is full-replacement                        |
| Error style      | Throw typed errors                | Central middleware translates to HTTP; less ceremony than Result<T,E> |
| Migrations       | Raw SQL + idempotent runner       | Matches the `pg` choice; SQL stays visible                            |
| Logging          | `pino`                            | Fastest Node logger; JSON-native; redaction built in                  |
| Tests            | Vitest + supertest                | Unified across workspaces; native ESM/TS; faster than Jest            |
| DI               | Composition root (single file)    | DI containers are overkill for a 5-module app; clearer                |
| API docs         | OpenAPI 3.1 from zod + Swagger UI | Spec cannot drift from validators; interactive explorer for reviewers |
