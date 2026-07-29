import { Router, type Request, type Response } from 'express';
import { checkRedisConnection } from '../repositories/redisClient';

const router = Router();

router.get('/health', async (_req: Request, res: Response): Promise<void> => {
  const redisHealthy = await checkRedisConnection();

  if (redisHealthy) {
    res.status(200).json({ status: 'ok', redis: 'connected' });
  } else {
    res.status(503).json({ status: 'degraded', redis: 'disconnected' });
  }
});

export { router as healthRouter };
