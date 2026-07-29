import { Router, type Request } from 'express';
import { loginHandler } from '../controllers/loginController';
import { createRateLimiter } from '../middleware/rateLimiter';

const WINDOW_MS = 15 * 60 * 1000;

// Broad backstop: 20 requests per IP per 15 minutes.
const loginIpLimiter = createRateLimiter({
  windowMs: WINDOW_MS,
  max: 20,
  keyPrefix: 'ratelimit:login:ip',
});

// Targeted credential-stuffing protection: 5 attempts per username per 15 minutes,
// regardless of source IP. Malformed bodies fall back to 'unknown' so this middleware
// never throws — validation owns that concern downstream.
const loginUsernameLimiter = createRateLimiter({
  windowMs: WINDOW_MS,
  max: 5,
  keyPrefix: 'ratelimit:login:user',
  keyGenerator: (req: Request): string => {
    const username = (req.body as { username?: unknown } | undefined)?.username;
    if (typeof username === 'string' && username.length > 0) {
      return username.toLowerCase();
    }
    return 'unknown';
  },
});

const router = Router();

router.post('/', loginIpLimiter, loginUsernameLimiter, loginHandler);

export { router as loginRouter };
