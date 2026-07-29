import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';

// Mock checkRedisConnection so we can control healthy/unhealthy state per test.
jest.mock('../../src/repositories/redisClient', () => ({
  redisClient: { quit: jest.fn(), on: jest.fn() },
  checkRedisConnection: jest.fn(),
}));

import { checkRedisConnection } from '../../src/repositories/redisClient';
import { createApp } from '../../src/app';

const mockCheckRedis = checkRedisConnection as jest.MockedFunction<typeof checkRedisConnection>;

describe('GET /health', () => {
  const app = createApp();

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    mockCheckRedis.mockReset();
  });

  it('returns 200 with status ok when Redis is reachable', async () => {
    mockCheckRedis.mockResolvedValueOnce(true);

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', redis: 'connected' });
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('returns 503 with status degraded when Redis is unreachable', async () => {
    mockCheckRedis.mockResolvedValueOnce(false);

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'degraded', redis: 'disconnected' });
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('passes through an incoming X-Request-Id header', async () => {
    mockCheckRedis.mockResolvedValueOnce(true);
    const clientId = 'my-trace-id-abc';

    const res = await request(app).get('/health').set('X-Request-Id', clientId);

    expect(res.headers['x-request-id']).toBe(clientId);
  });
});
