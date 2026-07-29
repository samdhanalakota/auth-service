import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express, { type Application } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestIdMiddleware } from './middleware/requestId';
import { healthRouter } from './routes/health';
import { registerRouter } from './routes/registerRoute';
import { logger } from './utils/logger';

export function createApp(): Application {
  const app = express();

  // Attach a correlation id to every request before anything else runs.
  app.use(requestIdMiddleware);

  // Security headers.
  app.use(helmet());

  // CORS.
  // TODO: restrict the origin allowlist per-environment in production.
  app.use(cors());

  // Parse JSON bodies.
  app.use(express.json());

  // HTTP request logging — forwards the request id into each log line.
  app.use(
    pinoHttp({
      logger,
      // Reuse the id already set by requestIdMiddleware so request logs share the same correlation id.
      genReqId: (req) => {
        const id = req.headers['x-request-id'];
        return typeof id === 'string' && id.length > 0 ? id : randomUUID();
      },
    }),
  );

  // Health check route.
  app.use(healthRouter);

  // Registration endpoint.
  app.use('/api/v1/register', registerRouter);

  // TODO: mount /api/v1/login route here (Phase 5).

  // 404 fallback — must come after all real routes.
  app.use(notFoundHandler);

  // Central error handler — must be the last middleware registered.
  app.use(errorHandler);

  return app;
}
