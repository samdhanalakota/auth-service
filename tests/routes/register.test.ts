import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';

jest.mock('ioredis', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-return -- jest mock factory needs sync require
  return require('ioredis-mock');
});

// Rate limiting is tested separately in tests/middleware/rateLimiter.test.ts.
// Here we replace it with a pass-through so the register integration tests
// focus on registration logic, not rate limiting.
jest.mock('../../src/middleware/rateLimiter', () => ({
  createRateLimiter: () =>
    (_req: Request, _res: Response, next: NextFunction): void => next(),
}));

import { redisClient } from '../../src/repositories/redisClient';
import { createApp } from '../../src/app';

const app = createApp();

const VALID_USERNAME = 'testuser1';
const VALID_PASSWORD = 'Correct-Horse!9';

describe('POST /api/v1/register', () => {
  beforeEach(async () => {
    await redisClient.flushall();
  });

  afterAll(() => {
    jest.restoreAllMocks();
    redisClient.disconnect();
  });

  it('returns 201 with { username, createdAt } on valid input', async () => {
    const res = await request(app)
      .post('/api/v1/register')
      .send({ username: VALID_USERNAME, password: VALID_PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ username: VALID_USERNAME });
    expect(typeof (res.body as { createdAt: unknown }).createdAt).toBe('string');
    // Must not leak hash or any other internal field.
    expect(res.body).not.toHaveProperty('passwordHash');
    expect(Object.keys(res.body as object)).toEqual(['username', 'createdAt']);
  });

  it('normalizes username to lowercase in the response', async () => {
    const res = await request(app)
      .post('/api/v1/register')
      .send({ username: 'TestUser2', password: VALID_PASSWORD });

    expect(res.status).toBe(201);
    expect((res.body as { username: string }).username).toBe('testuser2');
  });

  it('returns 400 VALIDATION_ERROR when password is missing', async () => {
    const res = await request(app)
      .post('/api/v1/register')
      .send({ username: VALID_USERNAME });

    expect(res.status).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when username is missing', async () => {
    const res = await request(app)
      .post('/api/v1/register')
      .send({ password: VALID_PASSWORD });

    expect(res.status).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 WEAK_PASSWORD with a details array when password is too weak', async () => {
    const res = await request(app)
      .post('/api/v1/register')
      .send({ username: VALID_USERNAME, password: 'short' });

    expect(res.status).toBe(400);
    const body = res.body as { error: { code: string; details: string[] } };
    expect(body.error.code).toBe('WEAK_PASSWORD');
    expect(Array.isArray(body.error.details)).toBe(true);
    expect(body.error.details.length).toBeGreaterThan(0);
  });

  it('returns 409 USERNAME_TAKEN when registering the same username twice', async () => {
    await request(app)
      .post('/api/v1/register')
      .send({ username: VALID_USERNAME, password: VALID_PASSWORD });

    const res = await request(app)
      .post('/api/v1/register')
      .send({ username: VALID_USERNAME, password: VALID_PASSWORD });

    expect(res.status).toBe(409);
    expect((res.body as { error: { code: string } }).error.code).toBe('USERNAME_TAKEN');
  });

  it('returns 400 VALIDATION_ERROR when the body contains an extra unexpected field', async () => {
    const res = await request(app)
      .post('/api/v1/register')
      .send({ username: VALID_USERNAME, password: VALID_PASSWORD, role: 'admin' });

    expect(res.status).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR');
  });

  it('includes an X-Request-Id header on every response', async () => {
    const resSuccess = await request(app)
      .post('/api/v1/register')
      .send({ username: VALID_USERNAME, password: VALID_PASSWORD });
    expect(resSuccess.headers['x-request-id']).toBeTruthy();

    const resError = await request(app)
      .post('/api/v1/register')
      .send({ username: VALID_USERNAME });
    expect(resError.headers['x-request-id']).toBeTruthy();
  });
});
