/**
 * Runs before every test file so imports that pull in src/config
 * do not call process.exit(1) when local env vars are unset.
 */
process.env.PORT ??= '3000';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.JWT_SECRET ??= 'test-jwt-secret-with-32-plus-chars!!';
process.env.JWT_EXPIRES_IN ??= '900';
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL ??= 'info';
