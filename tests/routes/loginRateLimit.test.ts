import { describe, expect, it, jest } from '@jest/globals';
import { MemoryStore } from 'express-rate-limit';
import express, { type Request } from 'express';
import request from 'supertest';

jest.mock('ioredis', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-return -- jest mock factory needs sync require
  return require('ioredis-mock');
});

import { errorHandler } from '../../src/middleware/errorHandler';
import { requestIdMiddleware } from '../../src/middleware/requestId';
import { createRateLimiter } from '../../src/middleware/rateLimiter';

// Mirrors the dual-limiter stack on loginRoute.ts, but uses MemoryStore and a
// low per-username max so we can exercise the 429 path without waiting on the
// real 5/15min window. Intentionally does NOT mock createRateLimiter.
function buildLoginRateLimitApp(usernameMax = 2): express.Application {
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());

  const ipLimiter = createRateLimiter({
    windowMs: 60_000,
    max: 100,
    keyPrefix: 'ratelimit:login:ip:test',
    store: new MemoryStore(),
  });

  const usernameLimiter = createRateLimiter({
    windowMs: 60_000,
    max: usernameMax,
    keyPrefix: 'ratelimit:login:user:test',
    store: new MemoryStore(),
    keyGenerator: (req: Request): string => {
      const username = (req.body as { username?: unknown } | undefined)?.username;
      if (typeof username === 'string' && username.length > 0) {
        return username.toLowerCase();
      }
      return 'unknown';
    },
  });

  app.post('/login', ipLimiter, usernameLimiter, (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use(errorHandler);
  return app;
}

describe('login dual rate limiters', () => {
  it('returns 429 RATE_LIMITED after the per-username limit is exceeded', async () => {
    const app = buildLoginRateLimitApp(2);
    const body = { username: 'alice', password: 'anything' };

    await request(app).post('/login').send(body);
    await request(app).post('/login').send(body);
    const res = await request(app).post('/login').send(body);

    expect(res.status).toBe(429);
    expect((res.body as { error: { code: string } }).error.code).toBe('RATE_LIMITED');
  });

  it('includes a Retry-After header on the per-username 429', async () => {
    const app = buildLoginRateLimitApp(1);
    const body = { username: 'bob', password: 'anything' };

    await request(app).post('/login').send(body);
    const res = await request(app).post('/login').send(body);

    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('does not share the per-username counter across different usernames', async () => {
    const app = buildLoginRateLimitApp(1);

    const first = await request(app)
      .post('/login')
      .send({ username: 'alice', password: 'anything' });
    expect(first.status).toBe(200);

    // A different username should still be allowed even though alice is now limited.
    const other = await request(app)
      .post('/login')
      .send({ username: 'charlie', password: 'anything' });
    expect(other.status).toBe(200);

    const limited = await request(app)
      .post('/login')
      .send({ username: 'alice', password: 'anything' });
    expect(limited.status).toBe(429);
  });

  it('lowercases the username key so Alice and alice share one counter', async () => {
    const app = buildLoginRateLimitApp(1);

    await request(app).post('/login').send({ username: 'Alice', password: 'anything' });
    const res = await request(app)
      .post('/login')
      .send({ username: 'alice', password: 'anything' });

    expect(res.status).toBe(429);
  });
});
