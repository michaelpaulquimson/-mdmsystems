# MDM Systems — CLAUDE.md

AI-session instructions for this repository. See `README.md` for the human-reviewer quickstart.

---

## Stack & Ports

| Layer    | Tech                                   | Port |
| -------- | -------------------------------------- | ---- |
| Frontend | React 18 + Vite + Tailwind + shadcn/ui | 5173 |
| Backend  | Node 22 + Express + TypeScript         | 4000 |
| Database | PostgreSQL 16 (pg raw SQL)             | 5432 |

Run everything: `make up` (or `cp .env.example .env && docker compose up -d`).

---

## Workspace Layout

```
mdmsystems/
├── shared/     @mdm/shared — zod schemas, inferred types, Permissions, ErrorCode
├── backend/    Node API — feature/module-based
├── frontend/   React admin — feature-based (Bulletproof React)
├── e2e/        Playwright golden-path tests
└── mobile/     Phase 2 (Expo — not built yet)
```

**Single source of truth rule**: All zod schemas, inferred TS types, `Permissions` constants, and `ErrorCode` enum live in `@mdm/shared`. Never duplicate them in `backend/` or `frontend/`.

---

## Strict Layering (never violate)

```
HTTP → routes → middleware (auth + permission + validate) → controller
     → service (business rules + org-scoping) → repository (SQL only) → pg.Pool → Postgres
```

- **SQL lives only in `**/repositories/\*.ts` files.\*\* Controllers and services never write SQL.
- **Controllers are HTTP shells.** No business logic, no try/catch — throw typed errors, let central middleware handle.
- **Services take repos via constructor.** Never `import pool` inside a service.
- **Composition root** (`src/composition-root.ts`) is the only place that `new`s repositories, services, and controllers.

---

## Database Conventions

- UUID PKs (`gen_random_uuid()` from `pgcrypto`).
- Column names: `snake_case`. TS domain types: `camelCase`. Mapped in the repository row mapper.
- `timestamptz` for all timestamps. UTC everywhere on the backend.
- JSONB for `roles.permissions` (array of permission strings).
- **Parameterized queries only.** Never string-concatenate into SQL.
- **Migrations are forward-only.** Never edit a shipped migration. Add a new numbered file.
- `schema_migrations` table tracks applied migrations (idempotent runner).

---

## Auth Model

- **Access JWT**: 15-minute expiry, `HS256`, `Authorization: Bearer` header. Never in a cookie.
- **Refresh token**: opaque 32-byte random, 30-day expiry, stored as `sha-256` hash. Rotated on every `/auth/refresh`. Reuse of a spent token revokes the whole chain.
- **`is_admin = true`** bypasses all permission checks — admin-only routes use `requireAdmin`.
- **Non-admin RBAC**: `roles.permissions` JSONB array checked by `requirePermission(Permissions.X)`.
- Permission strings are constants in `@mdm/shared` (e.g., `Permissions.CONTENT_UPDATE`). Never raw strings.

---

## Audit Logging Rule

Every mutating service method (`create`, `update`, `delete`) calls `auditService.record(...)` inside the **same `withTransaction`** as the mutation. Audit and data commit together or roll back together.

- Never write audit rows in Express middleware (middleware can't see domain before/after).
- Never write audit rows outside a transaction.

---

## Multi-Tenancy (Org Scoping)

- **Admin** (`is_admin = true`): sees all rows across all orgs.
- **Non-admin**: every list/get/mutate is filtered by `organization_id = req.user.organizationId`. Enforced at the **service layer**.
- Cross-org access by non-admins → **404** (not 403 — don't leak existence).

---

## Coding Standards

**TypeScript**

- `strict: true` + `noUncheckedIndexedAccess`. Zero `any`. Use `unknown` at boundaries.
- All types are `z.infer<typeof Schema>` — never hand-write a type that has a schema.
- Named exports only. No `export default`.
- File naming: `kebab-case.kind.ts` (`user.service.ts`, `use-organizations.ts`).
- One major export per file.
- `async/await` only — no `.then()` chains.
- Early returns preferred over nested `if`.

**Classes vs functions**

- Services and repositories are **classes** (constructor DI). Pure utilities are functions.

**Errors**

- Throw typed errors (`throw new NotFoundError(...)`) anywhere. Central middleware maps to HTTP.
- No try/catch in controllers. No `Result<T,E>` type.

**Imports order** (ESLint enforced)

1. Node builtins
2. Third-party
3. `@mdm/shared`
4. `@/core/*`
5. `@/modules/*` (other module barrels only — never deep paths)
6. Relative

**Method order in classes**: `constructor` → public (same order as interface) → private helpers.

---

## Adding a New Entity

1. Add zod schemas + inferred types to `shared/src/schemas/<entity>.schema.ts` (with `.openapi(...)` annotation).
2. Add migration SQL in `backend/src/core/db/migrations/00N_add_<entity>.sql`.
3. Create `backend/src/modules/<entity>/` with: `<entity>.repository.ts`, `<entity>.service.ts`, `<entity>.controller.ts`, `<entity>.routes.ts`, `index.ts`, `tests/`.
4. Wire into `backend/src/composition-root.ts`.
5. Register routes in the OpenAPI registry (`registry.registerPath(...)`) inside `<entity>.routes.ts`.
6. Create `frontend/src/features/<entity>/` with: `api/<entity>.api.ts`, `hooks/use-*.ts`, `components/`, `pages/<entity>-page.tsx`.
7. Add route to `frontend/src/app/router.tsx` behind `<ProtectedRoute>`.
8. Add integration test matrix (200/201/204/400/401/403/404/org-scoping).

---

## Adding a New Permission

1. Add constant to `shared/src/permissions.ts` (e.g., `REPORT_READ: 'report:read'`).
2. Attach to relevant roles in `backend/src/core/db/migrations/00N_update_roles.sql`.
3. Guard the route: `requirePermission(Permissions.REPORT_READ)` in `<entity>.routes.ts`.
4. Gate the UI: `<Gate permission={Permissions.REPORT_READ}>` or `usePermission(Permissions.REPORT_READ)`.

---

## OpenAPI Rule

Every entity zod schema in `@mdm/shared` calls `.openapi({ description: '...', example: {...} })` on its top-level shape. Every route registered in `core/openapi/registry.ts` includes request/response schemas and security (`bearerAuth`). The spec must never drift from the validators.

---

## Git Workflow

- Conventional Commits enforced by commitlint. `git commit --no-verify` is banned.
- `lint-staged` runs on staged files only — fast and non-blocking.
- PR template is required. CODEOWNERS auto-assigns reviewers.

---

## Anti-Patterns (banned)

- ❌ ORMs (Prisma / TypeORM / Sequelize)
- ❌ SQL outside `**/repositories/*.ts`
- ❌ String concatenation into SQL
- ❌ `any` in TypeScript
- ❌ Hand-written types when a schema exists in `@mdm/shared`
- ❌ Deep cross-module imports (`@/modules/users/services/...`) — use module barrels
- ❌ `core/` importing from `modules/`
- ❌ `export default`
- ❌ Magic permission strings — use `Permissions.*`
- ❌ Magic error codes — use `ErrorCode.*`
- ❌ Logging JWTs, passwords, or `/auth/*` bodies
- ❌ Editing a shipped migration
- ❌ PUT for partial updates — use PATCH
- ❌ Trusting frontend permission checks for security
- ❌ One-click DELETE — confirmation dialog always
- ❌ Committing `.env` or secrets
- ❌ `git commit --no-verify`
- ❌ Audit rows outside the mutation's transaction
- ❌ Audit rows in middleware
- ❌ Refresh tokens stored raw (hash with sha-256)
- ❌ JWTs in AsyncStorage on mobile (use expo-secure-store)

---

## Onboarding Checklist (Day 1 → Day 3)

**Day 1** — Read in order: `README.md` → `docs/ARCHITECTURE.md` → one full module (`backend/src/modules/organizations/`) → one feature (`frontend/src/features/organizations/`) → this file's Coding Standards section.

**Day 2** — `make up`, log in with each seed user (see README), explore API via Swagger UI (`http://localhost:4000/api/v1/docs`) and Postman collection.

**Day 3** — `make test`, `make test-int`. Read one integration test (`backend/src/modules/organizations/tests/organization.routes.test.ts`) top-to-bottom.
