import { config } from './config';
import { redisClient } from './repositories/redisClient';
import { logger } from './utils/logger';
import { createApp } from './app';

const SHUTDOWN_TIMEOUT_MS = 10_000;

const app = createApp();

const server = app.listen(config.PORT, () => {
  logger.info(`Server is listening on port ${config.PORT.toString()}.`);
});

function shutdown(signal: string): void {
  logger.info(`Received ${signal}. Starting graceful shutdown.`);

  const forceExitTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out. Forcing exit.');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  // Allow the timer to be garbage-collected if shutdown completes in time.
  forceExitTimer.unref();

  server.close(() => {
    logger.info('HTTP server closed. Closing Redis connection.');

    redisClient
      .quit()
      .then(() => {
        logger.info('Redis connection closed. Shutdown complete.');
        process.exit(0);
      })
      .catch((err: unknown) => {
        logger.error({ err }, 'Error while closing the Redis connection during shutdown.');
        process.exit(1);
      });
  });
}

process.on('SIGTERM', () => { shutdown('SIGTERM'); });
process.on('SIGINT', () => { shutdown('SIGINT'); });
