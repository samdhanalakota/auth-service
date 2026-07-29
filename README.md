# Auth Service

A simple authentication API built for the Lendesk take-home assignment. Node.js, TypeScript, Redis, Argon2id, JWT.

Two endpoints: register and login. See `docs/SPEC.md` for the full API contract and `docs/SECURITY_DECISIONS.md` for why things were built this way.

## Setup

You need Docker, or Node 20+ with a local Redis.

**With Docker (easiest):**

```bash
cp .env.example .env
```

Open `.env` and set `JWT_SECRET` to something random and at least 32 characters. You can generate one with:

```bash
openssl rand -hex 32
```

Then run:

```bash
docker-compose up --build
```

App runs at `http://localhost:3000`.

**Without Docker:**

```bash
npm install
cp .env.example .env
# set JWT_SECRET as above

# start Redis somehow, e.g.
docker run -d -p 6379:6379 redis:7-alpine

npm run dev
```

## API

**Register**
```
POST /api/v1/register
{ "username": "...", "password": "..." }
```
Returns `201` and `{ username, createdAt }`. `409` if the username is taken, `400` if the input is invalid or the password is too weak, `429` if you're rate limited.

**Login**
```
POST /api/v1/login
{ "username": "...", "password": "..." }
```
Returns `200` and `{ token, expiresIn }`. Returns `401` for a wrong password or a username that doesn't exist — on purpose, both cases look identical from the outside.

**Health check**
```
GET /health
```
Returns `200` if Redis is reachable, `503` if not.

Full contract, status codes, and error shapes are in `docs/SPEC.md`.

## Security 
- see docs/SECURITY_DECISIONS.md

## What's not included, on purpose

- No email field. The brief only asked for username and password.
- No Postgres. Brief said Redis, so just Redis.
- No refresh tokens, just a short-lived access token.
- CORS is wide open right now, with a TODO in `src/app.ts` — in a real deployment this would be locked down per environment.
- No TLS in the app itself — that's normally handled by a load balancer in front of the service, not something to build here.

## How this was built

Built with Cursor, spec-first. The API contract and security decisions were written down in `docs/SPEC.md` before any code was generated. `.cursor/rules/` has the project's conventions so the AI-generated code stays consistent. Every piece was reviewed against the spec before being committed.

## Tests

```bash
npm test
npm run test:coverage
```

Tests don't need a real Redis running, they use ioredis-mock.

## npm audit

`npm audit` shows a bunch of high severity warnings. All of them trace back to one issue (`brace-expansion`) inside Jest's own dependencies, dev-only, never touches production code. Running `npm audit --omit=dev` shows zero issues. The suggested fix downgrades `ts-jest` two major versions, which isn't worth it for a dev-only, non-exploitable finding, so it was left alone.

## Future work

- Refresh tokens
- Real CORS allowlist per environment
- Slow down repeated failed logins further (backoff or CAPTCHA)
- Real secrets manager instead of `.env` in production
