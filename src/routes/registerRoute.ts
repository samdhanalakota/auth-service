import { Router } from 'express';
import { registerHandler } from '../controllers/registerController';
import { createRateLimiter } from '../middleware/rateLimiter';

// 10 requests per IP per hour for registration, per the spec.
const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyPrefix: 'ratelimit:register:ip',
});

const router = Router();

router.post('/', registerLimiter, registerHandler);

export { router as registerRouter };
