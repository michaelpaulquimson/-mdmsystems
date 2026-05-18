# 0003 — JWT in Authorization header (not cookies)

**Date:** 2026-05-01  
**Status:** Accepted

## Context

Where to store and transmit the access token: `Authorization: Bearer` header vs `HttpOnly` cookie.

## Decision

JWT in the `Authorization: Bearer` header. The frontend stores the access token in Zustand (in-memory, not persisted). The mobile app stores it in Zustand as well (in-memory). Refresh tokens are persisted: `localStorage` via Zustand `persist` on web, `expo-secure-store` on mobile.

## Consequences

**Positive:**

- Stateless — the same backend serves React web and React Native without any change.
- Structurally immune to CSRF: browsers do not auto-attach `Authorization` headers on cross-origin requests, so no CSRF token machinery is needed.
- Works identically in Expo (no cookie jar on mobile).

**Negative:**

- Access tokens are in JavaScript memory (XSS risk if an attacker can run arbitrary JS). Mitigated by a strict Content Security Policy and the 15-minute expiry.
- `HttpOnly` cookies would be more XSS-resistant for browser-only apps, but they require CSRF protection and are incompatible with React Native.

## Alternatives considered

- **HttpOnly cookie** — better XSS story for web-only apps, but requires CSRF tokens and can't be used by Expo on mobile.
- **localStorage directly** — never: `localStorage` is accessible to any script on the page and is often flagged by security audits.
