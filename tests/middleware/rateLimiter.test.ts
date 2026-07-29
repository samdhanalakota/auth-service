import { describe, expect, it, jest } from '@jest/globals';
import { MemoryStore } from 'express-rate-limit';
import request from 'supertest';
import express from 'express';

jest.mock('ioredis', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-return -- jest mock factory needs sync require
  return require('ioredis-mock');
});

import { errorHandler } from '../../src/middleware/errorHandler';
import { requestIdMiddleware } from '../../src/middleware/requestId';
import { createRateLimiter } from '../../src/middleware/rateLimiter';

/**
 * Builds a minimal Express app with the rate limiter under test.
 * Uses MemoryStore so there is no ioredis-mock dependency here.
 * max is intentionally low (2) so tests don't need to fire many requests.
 */
function buildTestApp(max = 2): express.Application {
  const app = express();
  app.use(requestIdMiddleware);

  const limiter = createRateLimiter({
    windowMs: 60_000,
    max,
    keyPrefix: 'ratelimit:test',
    store: new MemoryStore(),
  });

  app.get('/test', limiter, (_req, res) => {
    res.json({ ok: true });
  });

  app.use(errorHandler);
  return app;
}

describe('createRateLimiter', () => {
  it('allows requests under the limit', async () => {
    const app = buildTestApp(2);

    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
  });

  it('returns 429 with RATE_LIMITED error envelope after the limit is exceeded', async () => {
    const app = buildTestApp(2);

    await request(app).get('/test');
    await request(app).get('/test');
    const res = await request(app).get('/test'); // third request — over the limit

    expect(res.status).toBe(429);
    expect((res.body as { error: { code: string } }).error.code).toBe('RATE_LIMITED');
  });

  it('includes a Retry-After header on the 429 response', async () => {
    const app = buildTestApp(1);

    await request(app).get('/test');
    const res = await request(app).get('/test'); // over limit

    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('includes an X-Request-Id header on the 429 response', async () => {
    const app = buildTestApp(1);

    await request(app).get('/test');
    const res = await request(app).get('/test');

    expect(res.status).toBe(429);
    expect(res.headers['x-request-id']).toBeTruthy();
  });
});
