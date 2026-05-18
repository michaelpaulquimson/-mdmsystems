# 0006 — Single source of truth: `@mdm/shared` zod schemas

**Date:** 2026-05-01  
**Status:** Accepted

## Context

Backend validation (request bodies), frontend form validation, and TypeScript types for API data all need to agree on the shape of every entity. They could each define their own schemas, or share one.

## Decision

All zod schemas, inferred TypeScript types, `Permissions` constants, and `ErrorCode` enum live in the `@mdm/shared` npm workspace package. Backend, frontend, and mobile all import from `@mdm/shared`. Nothing is duplicated.

## Consequences

**Positive:**

- Schema drift between backend and frontend is structurally impossible — both compile from the same zod definitions.
- Adding a field in one place automatically updates types everywhere.
- Password policy, email normalisation, and field constraints are enforced identically on backend validation, frontend form validation, and mobile form validation.
- OpenAPI spec is generated from the same schemas (via `@asteasolutions/zod-to-openapi`) — docs cannot drift from validators.

**Negative:**

- The shared package must be built before backend/frontend (handled by TypeScript project references and the workspace install order).
- Changes to shared schemas require updating all consumers simultaneously.

## Alternatives considered

- **Separate per-app schemas** — simpler initially but inevitably diverges, causing silent bugs when frontend allows values the backend rejects or vice versa.
- **OpenAPI spec as source of truth + code generation** — tool complexity; generated types are often less ergonomic than hand-shaped zod schemas.
