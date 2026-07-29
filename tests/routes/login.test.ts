import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';

jest.mock('ioredis', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-return -- jest mock factory needs sync require
  return require('ioredis-mock');
});

// Rate limiting is tested separately in tests/middleware/rateLimiter.test.ts.
// Register's rate limiter is exercised during beforeEach setup, so mock it here too.
jest.mock('../../src/middleware/rateLimiter', () => ({
  createRateLimiter: () =>
    (_req: Request, _res: Response, next: NextFunction): void => next(),
}));

import { redisClient } from '../../src/repositories/redisClient';
import { createApp } from '../../src/app';

const app = createApp();

const VALID_USERNAME = 'loginuser1';
const VALID_PASSWORD = 'Correct-Horse!9';
const JWT_SECRET = process.env['JWT_SECRET'] ?? '';

describe('POST /api/v1/login', () => {
  beforeEach(async () => {
    await redisClient.flushall();
    const reg = await request(app)
      .post('/api/v1/register')
      .send({ username: VALID_USERNAME, password: VALID_PASSWORD });
    expect(reg.status).toBe(201);
  });

  afterAll(() => {
    jest.restoreAllMocks();
    redisClient.disconnect();
  });

  it('returns 200 with { token, expiresIn } on correct credentials', async () => {
    const res = await request(app)
      .post('/api/v1/login')
      .send({ username: VALID_USERNAME, password: VALID_PASSWORD });

    expect(res.status).toBe(200);
    const body = res.body as { token: string; expiresIn: number };
    expect(typeof body.token).toBe('string');
    expect(body.expiresIn).toBe(900);
    expect(Object.keys(body)).toEqual(['token', 'expiresIn']);
  });

  it('returns a JWT that contains the correct username', async () => {
    const res = await request(app)
      .post('/api/v1/login')
      .send({ username: VALID_USERNAME, password: VALID_PASSWORD });

    const body = res.body as { token: string };
    const decoded = jwt.verify(body.token, JWT_SECRET, { algorithms: ['HS256'] }) as {
      username: string;
    };
    expect(decoded.username).toBe(VALID_USERNAME);
  });

  it('returns 401 INVALID_CREDENTIALS for a wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/login')
      .send({ username: VALID_USERNAME, password: 'Wrong-Password!9' });

    expect(res.status).toBe(401);
    expect((res.body as { error: { code: string } }).error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns 401 INVALID_CREDENTIALS for an unknown username, with the same message as a wrong password', async () => {
    const wrongPassword = await request(app)
      .post('/api/v1/login')
      .send({ username: VALID_USERNAME, password: 'Wrong-Password!9' });

    const unknownUser = await request(app)
      .post('/api/v1/login')
      .send({ username: 'nobodyhere', password: VALID_PASSWORD });

    expect(unknownUser.status).toBe(401);
    expect((unknownUser.body as { error: { code: string } }).error.code).toBe(
      'INVALID_CREDENTIALS',
    );
    expect((unknownUser.body as { error: { message: string } }).error.message).toBe(
      (wrongPassword.body as { error: { message: string } }).error.message,
    );
  });

  it('returns 400 VALIDATION_ERROR when username is missing', async () => {
    const res = await request(app)
      .post('/api/v1/login')
      .send({ password: VALID_PASSWORD });

    expect(res.status).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when password is missing', async () => {
    const res = await request(app)
      .post('/api/v1/login')
      .send({ username: VALID_USERNAME });

    expect(res.status).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when the body contains an extra unexpected field', async () => {
    const res = await request(app)
      .post('/api/v1/login')
      .send({ username: VALID_USERNAME, password: VALID_PASSWORD, role: 'admin' });

    expect(res.status).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR');
  });

  it('includes an X-Request-Id header on every response', async () => {
    const resSuccess = await request(app)
      .post('/api/v1/login')
      .send({ username: VALID_USERNAME, password: VALID_PASSWORD });
    expect(resSuccess.headers['x-request-id']).toBeTruthy();

    const resError = await request(app)
      .post('/api/v1/login')
      .send({ username: VALID_USERNAME });
    expect(resError.headers['x-request-id']).toBeTruthy();
  });
});
