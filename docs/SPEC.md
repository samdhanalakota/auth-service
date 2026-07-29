# Auth API — Spec

Base path: `/api/v1`.

Success responses return the resource directly (Stripe/GitHub style). Errors use a structured envelope. The HTTP status code is the main success or failure signal.

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

Never return the password or hash. Do not issue a token on register — the client must call `/login` separately.

### Errors

| Case | Status | Code |
|---|---|---|
| Missing or invalid fields | 400 | `VALIDATION_ERROR` |
| Password fails complexity checks | 400 | `WEAK_PASSWORD` |
| Username already exists | 409 | `USERNAME_TAKEN` |
| Rate limit exceeded | 429 | `RATE_LIMITED` |
| Unexpected failure | 500 | `INTERNAL_ERROR` |

Error body shape:

```json
{
  "error": {
    "code": "STRING_CODE",
    "message": "human readable",
    "details": ["optional array"]
  }
}
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
| Invalid credentials (wrong password or unknown username — same response on purpose, to avoid username enumeration) | 401 | `INVALID_CREDENTIALS` |
| Missing or invalid fields | 400 | `VALIDATION_ERROR` |
| Rate limit exceeded | 429 | `RATE_LIMITED` |
| Unexpected failure | 500 | `INTERNAL_ERROR` |

---

## Endpoint 3 — Health

`GET /health` → `200 OK`

```json
{
  "status": "ok",
  "redis": "connected"
}
```

---

## Cross-cutting

- Every response includes an `X-Request-Id` header (a UUID correlation id for that request).
- `429` responses include `RateLimit-*` and `Retry-After` headers.
- Validate all request bodies with Zod, and reject unexpected fields.
- `expiresIn` follows the OAuth2 convention (RFC 6749): seconds until the token expires.

---

## Redis key design

- `user:{username}` — string value, JSON-encoded: `{ "passwordHash": "...", "createdAt": "ISO8601" }`
- Write with `SET user:{username} <json> NX` so create-if-absent is atomic and duplicate registration cannot race. A null reply means the key already exists (username taken).
- Read with `GET user:{username}`.
- Rate limit counters use TTL windows via `rate-limit-redis`:
  - `ratelimit:login:ip:{ip}`
  - `ratelimit:login:user:{username}`
  - `ratelimit:register:ip:{ip}`

---

## Username format

- Length: 3–30 characters.
- Allowed characters: letters, digits, underscore, hyphen, and period.
- Must start with a letter or digit.
- Normalize to lowercase before storage and lookup (uniqueness is case-insensitive).
- Reject whitespace; do not silently trim it.
- Explicitly reject `:`, `/`, `\`, `@`, spaces, and non-ASCII. Ban `:` and `/` in particular because they act as Redis key delimiters and the key pattern is `user:{username}`.

## Password complexity

- Minimum 12 characters.
- At least one uppercase letter, one lowercase letter, one digit, and one special character.
- Reject passwords that appear on a small common-password blocklist.
- When validation fails, put the specific failed rule(s) in `details`.

## JWT policy

- Pin the algorithm to `HS256` explicitly. Do not accept `alg: none`.
- Issue a short-lived access token only (default 900 seconds / 15 minutes). No refresh token in this scope.
- Load the secret from the environment and enforce a minimum length at boot. Fail fast if it is missing or too weak.
