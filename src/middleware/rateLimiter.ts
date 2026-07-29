import { rateLimit, type Store } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import type { Request, RequestHandler } from 'express';
import { redisClient } from '../repositories/redisClient';
import { RateLimitedError } from '../utils/errors';

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  // Prefix for Redis keys, e.g. "ratelimit:register:ip".
  keyPrefix: string;
  // Defaults to req.ip.
  keyGenerator?: (req: Request) => string;
  // Inject a custom store in tests to avoid ioredis-mock incompatibility with rate-limit-redis.
  store?: Store;
}
export function createRateLimiter(options: RateLimiterOptions): RequestHandler {
  const store: Store =
    options.store ??
    new RedisStore({
      prefix: options.keyPrefix,
      // rate-limit-redis expects a raw command sender; ioredis exposes this via .call().
      // The return type of .call() is broader than number, but rate-limit-redis only
      // ever uses this for EVALSHA/EVAL commands that return a number, so the cast is safe.
      sendCommand: (...args: [string, ...string[]]) =>
        redisClient.call(...args) as unknown as Promise<number>,
    });

  return rateLimit({
    windowMs: options.windowMs,
    limit: options.max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    store,
    keyGenerator: options.keyGenerator ?? ((req: Request): string => req.ip ?? 'unknown'),
    handler: (_req, _res, next) => {
      next(new RateLimitedError());
    },
  });
}
