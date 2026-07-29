import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

const MAX_RETRY_ATTEMPTS = 10;
const MAX_RETRY_DELAY_MS = 2000;

export const redisClient = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number): number | null {
    if (times > MAX_RETRY_ATTEMPTS) {
      logger.error(
        { attempt: times },
        'Gave up reconnecting to Redis after too many attempts.',
      );
      return null;
    }
    // Exponential backoff, capped
    return Math.min(2 ** times * 50, MAX_RETRY_DELAY_MS);
  },
});

redisClient.on('connect', () => {
  logger.info('Successfully connected to Redis.');
});

redisClient.on('error', (err: Error) => {
  logger.error({ err }, 'Redis client encountered an error.');
});

redisClient.on('close', () => {
  logger.warn('Lost connection to Redis.');
});

// Returns false on any error rather than throwing, so health check callers always get a boolean.
export async function checkRedisConnection(): Promise<boolean> {
  try {
    const result = await redisClient.ping();
    return result === 'PONG';
  } catch (err) {
    logger.error({ err }, 'Failed to ping Redis; treating the connection as unhealthy.');
    return false;
  }
}
