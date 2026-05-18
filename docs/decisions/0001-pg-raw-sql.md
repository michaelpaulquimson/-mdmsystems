# 0001 — Use `pg` raw SQL instead of an ORM

**Date:** 2026-05-01  
**Status:** Accepted

## Context

The application needs a database access layer for PostgreSQL. Options considered: Prisma, TypeORM, Sequelize, Knex, and `pg` with raw SQL behind a repository pattern.

## Decision

Use the `pg` driver with hand-written SQL inside repository classes. No ORM or query builder.

## Consequences

**Positive:**

- SQL is fully visible and reviewable — no magic query generation.
- Repository Pattern works best with real SQL; the interface + concrete class split gives clean unit-testable seams.
- No migration lock-in to an ORM's migration format; raw `.sql` files are portable.
- Schema drift is caught at the repository boundary via zod row parsing, not by trusting ORM types.

**Negative:**

- More boilerplate per query compared to an ORM.
- No auto-generated migrations; developers must write SQL manually.

## Alternatives considered

- **Prisma** — excellent DX but abstracts away SQL craft; migration format is Prisma-specific.
- **Knex** — query builder, still requires manual SQL understanding, adds a layer without removing complexity.
- **TypeORM** — decorator-based, heavy runtime, decorator support is unstable in ESM.
