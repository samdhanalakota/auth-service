# Security Decisions

## Passwords
Argon2id, not bcrypt — current OWASP recommendation, resists GPU cracking and timing attacks. Settings set explicitly (memoryCost 19456, timeCost 2, parallelism 1), not left as library defaults.

## Duplicate usernames
Redis `SET key value NX` — atomic set-if-not-exists. Prevents two simultaneous registrations for the same username from racing each other.

## Not leaking which usernames exist
Wrong password and unknown username return the identical response — same status, code, message. Timing is matched too: when the user doesn't exist, a real Argon2 check still runs against a dummy hash before rejecting, so the response doesn't come back suspiciously fast.

## JWT
HS256 pinned explicitly (never inferred). Payload is just the username. Short-lived access token only, no refresh. App refuses to start if `JWT_SECRET` is missing or under 32 characters.

## Rate limiting
Redis-backed. Register: 10/hour per IP. Login: 20/15min per IP, plus 5/15min per username (stops one account being hammered from many IPs).

## Logging
Pino, auto-redacts anything password/token/secret-shaped, at any nesting depth.

## Validation
Zod, strict mode, unknown fields rejected. Registration checks username format and password strength. Login doesn't — checking format there would itself leak whether a username is real.

## Dependencies
`npm audit` findings are all dev-only (`brace-expansion` inside Jest's dependency tree). `npm audit --omit=dev` is clean. Fixing it would mean downgrading `ts-jest` two majors — not worth it for a non-production issue.

## Deliberately skipped
Email field, Postgres, refresh tokens, CORS allowlist, TLS at app level, secrets manager — none needed for this brief; noted as future work instead.