# Security — MDM Systems

OWASP Top 10 (2021) mapping: every category and the concrete mitigation in this codebase.

---

## A01 — Broken Access Control

**Risk**: Users accessing data or operations outside their authorisation.

| Mitigation                                                                                  | Where                                                                                 |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| JWT verification on every protected route                                                   | `src/core/middleware/auth.middleware.ts` → `authRequired`                             |
| `requireAdmin` gate on all CRUD admin routes (orgs, teams, users, roles, audit)             | `auth.middleware.ts` → throws `ForbiddenError (403)`                                  |
| `requirePermission(Permissions.X)` gate on content routes                                   | `auth.middleware.ts` → checks `req.user.permissions` array                            |
| Non-admin requests filtered by `organization_id = req.user.organizationId` at service layer | Every service `list/get/mutate` method                                                |
| Cross-org access by non-admins returns **404**, not 403 — prevents existence leaks          | `organization.service.ts`, `team.service.ts`, `user.service.ts`, `content.service.ts` |
| Server-side checks are authoritative; UI gates are UX only                                  | `<Gate>` and `<ProtectedRoute>` in frontend                                           |

---

## A02 — Cryptographic Failures

**Risk**: Sensitive data exposed due to weak or missing encryption.

| Mitigation                                                                                  | Where                                           |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Passwords hashed with **bcrypt**, cost factor 12 (configurable via `BCRYPT_ROUNDS`)         | `src/modules/auth/auth.service.ts`              |
| Refresh tokens stored as **SHA-256 hash** — raw value never written to DB                   | `src/modules/auth/refresh-token.repository.ts`  |
| JWTs signed with `HS256`; `JWT_SECRET` validated at boot (min 32 chars)                     | `src/core/config/env.ts`, `auth.service.ts`     |
| HTTPS expected in production (TLS termination at load-balancer / reverse proxy layer)       | Documented assumption; not enforced in app code |
| No secrets in version control — `.env` is gitignored; `.env.example` has placeholder values | `.gitignore`, `.env.example`                    |

---

## A03 — Injection

**Risk**: SQL, command, or other injection via untrusted input.

| Mitigation                                                                     | Where                                        |
| ------------------------------------------------------------------------------ | -------------------------------------------- |
| **Parameterised queries only** — never string-concatenated SQL                 | All `**/repositories/*.ts` files             |
| SQL is restricted to repository layer by architecture + ESLint boundaries rule | `eslint-plugin-boundaries` config            |
| Request bodies validated by zod schemas before reaching any business logic     | `src/core/middleware/validate.middleware.ts` |
| Content body rendered as plain text only in frontend — no HTML/markdown        | Frontend content components                  |

---

## A04 — Insecure Design

**Risk**: Fundamental design flaws that cannot be patched away.

| Mitigation                                                                                | Design decision                                                        |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Org-scoping enforced at **service layer**, not per-controller                             | A new endpoint can't accidentally bypass it                            |
| Audit log written **inside the same transaction** as the mutation                         | Audit and data are always consistent; no way to mutate without a trail |
| Refresh token rotation with **reuse detection** — stolen-token theft detected at next use | `auth.service.ts` → revokes entire chain on reuse                      |
| `is_admin` is the sole gate for admin routes — no role-based escalation path              | Prevents privilege escalation via role manipulation                    |
| Access token expiry: **15 minutes** — minimises stolen-token blast radius                 | `auth.service.ts`                                                      |

---

## A05 — Security Misconfiguration

**Risk**: Default, incomplete, or insecure configuration.

| Mitigation                                                                                                                 | Where                                  |
| -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **`helmet`** sets secure HTTP headers (HSTS, X-Frame-Options, no-sniff, referrer-policy, …)                                | `src/app.ts`                           |
| CSP relaxed only on `/api/v1/docs` (Swagger UI requires inline scripts) — all other routes get strict defaults             | `src/app.ts` — conditional helmet call |
| **CORS allowlist** — `CORS_ORIGINS` env var; requests from unlisted origins are rejected                                   | `src/app.ts`                           |
| Environment validated at boot via zod — crashes immediately with a clear message if any required var is missing or invalid | `src/core/config/env.ts`               |
| `express.json({ limit: '100kb' })` — prevents request body amplification                                                   | `src/app.ts`                           |
| `JWT_SECRET` min-length enforced by zod schema (32 chars) — weak secrets fail at startup                                   | `env.ts`                               |
| `/metrics` endpoint protected by `METRICS_TOKEN` header in production                                                      | `src/composition-root.ts`              |

---

## A06 — Vulnerable and Outdated Components

**Risk**: Using components with known vulnerabilities.

| Mitigation                                                                                     | Where                      |
| ---------------------------------------------------------------------------------------------- | -------------------------- |
| `npm audit --audit-level=high` runs in CI on every push — high-severity advisories block merge | `.github/workflows/ci.yml` |
| **Dependabot** opens weekly grouped npm update PRs                                             | `.github/dependabot.yml`   |
| `engines` field in root `package.json` pins Node version                                       | `package.json`             |
| `package-lock.json` committed — reproducible installs everywhere                               | Repo root                  |

---

## A07 — Identification and Authentication Failures

**Risk**: Broken or missing auth, brute force, credential stuffing.

| Mitigation                                                                                              | Where                                        |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **Rate limiting on `/auth/login`**: 10 attempts per 15 minutes per IP                                   | `src/composition-root.ts` → `loginLimiter`   |
| **Rate limiting on `/auth/refresh`**: 30 attempts per 5 minutes per IP                                  | `src/composition-root.ts` → `refreshLimiter` |
| **Global API rate limit**: 100 requests/minute per IP                                                   | `src/app.ts`                                 |
| Bcrypt intentionally slow (cost 12) — brute-force of a stolen hash is expensive                         | `auth.service.ts`                            |
| **Refresh token reuse detection**: reusing a rotated token immediately revokes all tokens for that user | `auth.service.ts`                            |
| Access tokens short-lived (15 min) — limits the window of a stolen token                                | `auth.service.ts`                            |
| Case-insensitive email uniqueness index prevents `Foo@x.com` / `foo@x.com` duplicate accounts           | `001_init.sql` → `idx_users_email_lower`     |
| `POST /auth/logout` revokes the refresh token server-side; client clears auth store                     | `auth.service.ts`, `auth.store.ts`           |

---

## A08 — Software and Data Integrity Failures

**Risk**: Code or data that is not verified for integrity.

| Mitigation                                                                                                                   | Where                               |
| ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Zod schemas parse every request body at the HTTP boundary — malformed input is rejected before it reaches any business logic | `validate.middleware.ts`            |
| Zod schemas parse every DB row at the repository boundary — DB schema drift fails loudly at the data layer                   | `base.repository.ts` → `parseRow()` |
| Migrations are **forward-only** with a `schema_migrations` tracking table — applied migrations are never edited              | `src/core/db/migrate.ts`            |
| `npm audit` in CI — detects compromised dependencies                                                                         | `.github/workflows/ci.yml`          |
| `package-lock.json` committed — prevents lockfile tampering                                                                  | Repo root                           |

---

## A09 — Security Logging and Monitoring Failures

**Risk**: Breaches go undetected due to missing or inadequate logging.

| Mitigation                                                                                                                                                       | Where                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **Structured JSON logs** via `pino` + `pino-http` on every request (method, path, status, duration, user ID)                                                     | `src/app.ts`, `src/core/logger/logger.ts` |
| **`x-request-id` correlation header** on every response — trace any UI error to a backend log line                                                               | `pinoHttp` `genReqId` config              |
| **Audit log** in Postgres: every admin mutation (create/update/delete) logged with actor, before/after JSONB, IP, and timestamp — non-repudiation for compliance | `src/modules/audit/`                      |
| Auth events logged in audit log: `login`, `logout`, `refresh-reuse-detected`                                                                                     | `auth.service.ts`                         |
| **Prometheus metrics** at `/metrics`: HTTP request histogram, pg.Pool gauges, process metrics — operational anomalies (spike in 4xx/5xx) are visible             | `src/composition-root.ts`                 |
| `LOG_LEVEL` env var — can be set to `debug` in production temporarily for investigation without a code deploy                                                    | `env.ts`                                  |

**Redacted from logs** (configured in `pino`):

- `req.headers.authorization`
- `password`
- `password_hash`
- `token`

---

## A10 — Server-Side Request Forgery (SSRF)

**Risk**: Server makes requests to unintended internal resources based on user input.

| Mitigation                                    | Notes                                                         |
| --------------------------------------------- | ------------------------------------------------------------- |
| No user-supplied URLs are fetched server-side | The API never makes outbound HTTP calls based on request data |
| No webhook or URL-redirect features           | Out of scope for this application                             |

SSRF is not a realistic attack surface for this application's current feature set.

---

## Additional Hardening

### CSRF

JWT in `Authorization: Bearer` header is **structurally immune to CSRF**. Browsers don't auto-attach `Authorization` headers cross-origin, so no CSRF token machinery is needed. This was a deliberate design choice over cookie-based auth (see `docs/decisions/`).

### Content Security

`helmet` defaults block clickjacking (`X-Frame-Options: DENY`), MIME sniffing (`X-Content-Type-Options: nosniff`), and information leakage (`Referrer-Policy: no-referrer`). The CSP exception for Swagger UI is scoped to `/api/v1/docs` only.

### Password Policy

Enforced by the zod schema in `@mdm/shared`:

- Minimum 8 characters
- At least one numeric digit

Applied identically on backend (validate middleware) and frontend (zodResolver). This makes it impossible for a frontend bypass to succeed at the API level.

### Dependency Audit Budget

CI fails on `npm audit --audit-level=high`. Moderate-severity advisories are tracked but do not block builds — they are reviewed manually in Dependabot PRs.
