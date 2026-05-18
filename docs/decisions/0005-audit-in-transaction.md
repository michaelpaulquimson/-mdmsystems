# 0005 — Audit log written inside the mutation transaction

**Date:** 2026-05-01  
**Status:** Accepted

## Context

Every write operation (create, update, delete) must produce an audit log entry. Where should this happen — Express middleware, a service decorator, or inside the service method itself?

## Decision

Each mutating service method calls `auditService.record(...)` inside the **same `withTransaction`** as the database mutation. Audit and data commit together or roll back together.

## Consequences

**Positive:**

- Audit and mutation are atomically consistent — it is impossible for a mutation to succeed without an audit row, or for an audit row to exist without a successful mutation.
- Service-level instrumentation has access to the domain `before` and `after` snapshots — middleware cannot.
- No separate audit table polling or background job needed.

**Negative:**

- Every service method must explicitly call `auditService.record`. This is enforced by code review and documented in CLAUDE.md as a mandatory pattern.

## Alternatives considered

- **Express middleware** — runs too early (before the mutation) or too late (after the response), cannot access domain before/after, and cannot participate in the mutation's transaction.
- **Database triggers** — run outside the application context; no `actor_user_id`, no request-id, no IP address available.
- **AOP decorator** — adds framework complexity for a pattern that is explicit and readable as a direct service call.
