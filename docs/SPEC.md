# Auth API — Spec

**Base path:** `/api/v1`
**Response style:** Stripe/GitHub-style — success responses return the resource directly; only errors use a structured envelope. HTTP status code is the primary success/failure signal.

---

## Endpoint 1 — Register

`POST /api/v1/register`

### Request
```json
{
  "username": "string",
  "password": "string"
}
```

### Success — 201 Created
```json
{
  "username": "string",
  "createdAt": "ISO8601 timestamp"
}
```
No password/hash ever returned. No token issued on register — client must call `/login` separately.

### Errors
| Case | Status | Code |
|---|---|---|
| Missing/invalid fields | 400 | `VALIDATION_ERROR` |
| Password fails complexity | 400 | `WEAK_PASSWORD` |
| Username already exists | 409 | `USERNAME_TAKEN` |
| Rate limit exceeded | 429 | `RATE_LIMITED` |
| Unexpected failure | 500 | `INTERNAL_ERROR` |

Error body shape:
```json
{ "error": { "code": "STRING_CODE", "message": "human readable", "details": [ "optional array" ] } }
```

---

## Endpoint 2 — Login

`POST /api/v1/login`

### Request
```json
{
  "username": "string",
  "password": "string"
}
```

### Success — 200 OK
```json
{
  "token": "jwt-string",
  "expiresIn": 900
}
```

### Errors
| Case | Status | Code |
|---|---|---|
| Invalid credentials (wrong password OR unknown username — identical response, intentional, prevents enumeration) | 401 | `INVALID_CREDENTIALS` |
| Missing/invalid fields | 400 | `VALIDATION_ERROR` |
| Rate limit exceeded | 429 | `RATE_LIMITED` |
| Unexpected failure | 500 | `INTERNAL_ERROR` |

---

## Endpoint 3 — Health

`GET /health` → `200 OK`
```json
{ "status": "ok", "redis": "connected" }
```

---

## Cross-cutting

- Every response includes `X-Request-Id` header (correlation ID, UUID per request)
- 429 responses include `RateLimit-*` and `Retry-After` headers
- All request bodies validated via Zod; unexpected fields rejected
- `expiresIn` follows OAuth2 convention (RFC 6749) — seconds until token expiry

---

## Redis Key Design (final)

- `user:{username}` → String, JSON-encoded value: `{ "passwordHash": "...", "createdAt": "ISO8601" }`
- Write: `SET user:{username} <json> NX` — atomic create-if-absent, prevents race condition on duplicate registration (returns null if key already exists = username taken)
- Read: `GET user:{username}`
- Rate limit counters: `ratelimit:login:ip:{ip}`, `ratelimit:login:user:{username}`, `ratelimit:register:ip:{ip}` — TTL-based windows via `rate-limit-redis`

---

## Username Format Policy

- Length: 3–30 characters
- Allowed characters: letters, digits, underscore, hyphen, period
- Must start with a letter or digit
- Normalized to lowercase before storage/lookup (case-insensitive uniqueness)
- No whitespace (rejected, not silently trimmed)
- Explicitly rejected: `:`, `/`, `\`, `@`, spaces, non-ASCII — `:`/`/` specifically excluded because they are Redis key-delimiter characters and the key pattern is `user:{username}`

## Password Complexity Policy

- Minimum 12 characters
- At least 1 uppercase, 1 lowercase, 1 digit, 1 special character
- Rejected against a small common-password blocklist
- Validation errors return which specific rule(s) failed in `details`

## JWT Policy

- Algorithm pinned explicitly: `HS256` (no `alg: none` acceptance)
- Short-lived access token only (default 900s / 15 min) — no refresh token in this scope
- Secret loaded from env, minimum length enforced at boot (fail-fast if missing/weak)