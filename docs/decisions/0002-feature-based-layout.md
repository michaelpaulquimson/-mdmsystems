# 0002 — Feature-based folder layout (backend and frontend)

**Date:** 2026-05-01  
**Status:** Accepted

## Context

How to organise source files: by layer (`controllers/`, `services/`, `repositories/`) or by bounded context (`modules/organizations/`, `modules/users/`).

## Decision

Feature-based layout on both backend and frontend. Each bounded context owns all of its layers in a single folder.

## Consequences

**Positive:**

- A new developer opens one folder and finds everything about an entity.
- Refactoring a feature is contained — no cross-cutting changes across `controllers/`, `services/`, `repositories/`.
- Aligns with industry standards: NestJS modules (backend), Bulletproof React (frontend).
- ESLint `boundaries` plugin enforces the rule at lint time — architecture is enforced, not aspirational.

**Negative:**

- Cross-cutting infrastructure (pool, middleware, error classes) still lives in `core/` — the split between `core/` and `modules/` must be learned.

## Alternatives considered

- **Layer-based** (`controllers/`, `services/`, `repositories/`) — familiar but causes wide blast radius for any entity-level refactor and makes it hard to find "all the things about users".
