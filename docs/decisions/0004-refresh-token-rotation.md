# 0004 — Rotating refresh tokens with reuse detection

**Date:** 2026-05-01  
**Status:** Accepted

## Context

Access JWTs expire in 15 minutes. Long-lived sessions need a mechanism to issue new access tokens without forcing users to re-login. How to implement this securely?

## Decision

Rotating refresh tokens stored hashed at rest:

1. Login issues an opaque 32-byte random refresh token (base64url). Only the `sha-256` hash is stored.
2. Every `/auth/refresh` call rotates the token: the old token is marked `revoked_at` and `replaced_by`, a new pair is issued.
3. **Reuse detection**: if a token that already has `replaced_by` set is presented, all active tokens for that user are revoked. The user must re-login. This detects token theft — if an attacker uses a stolen token after the legitimate client has already rotated it, the whole session is killed.

The check order in the service (`replaced_by` before `revoked_at`) is critical: a rotated token has both fields set, and checking `revoked_at` first would swallow the reuse signal and skip chain revocation.

## Consequences

**Positive:**

- Stolen refresh tokens are detected within one rotation cycle.
- Tokens are never stored raw — a DB breach reveals only sha-256 hashes.
- Auth events (`login`, `logout`, `token-refreshed`, `refresh-reuse-detected`) are all audited.

**Negative:**

- More complex than a single long-lived JWT.
- If the client crashes between receiving the new token and persisting it, the old token is already revoked and the user is locked out. Mitigated by the 30-day expiry giving a wide window.

## Alternatives considered

- **Long-lived access JWT (days/weeks)** — simpler, but a stolen token is usable until expiry with no revocation mechanism.
- **Server-side session store** — fully revocable but stateful; incompatible with the stateless Bearer header approach needed for React Native.
