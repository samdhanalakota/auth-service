import { afterAll, describe, expect, it, jest } from '@jest/globals';

jest.mock('ioredis', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest mock factory
  const RedisMock = require('ioredis-mock') as typeof import('ioredis-mock');
  return RedisMock;
});

import { checkRedisConnection, redisClient } from '../../src/repositories/redisClient';

describe('redisClient', () => {
  afterAll(() => {
    redisClient.disconnect();
  });

  it('checkRedisConnection returns true when Redis responds', async () => {
    await expect(checkRedisConnection()).resolves.toBe(true);
  });

  it('checkRedisConnection returns false on failure without throwing', async () => {
    const pingSpy = jest.spyOn(redisClient, 'ping').mockRejectedValueOnce(new Error('connection refused'));

    await expect(checkRedisConnection()).resolves.toBe(false);
    expect(pingSpy).toHaveBeenCalled();

    pingSpy.mockRestore();
  });
});
