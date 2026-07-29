import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

// override: false ensures dotenv never clobbers env vars already set in the
// process (e.g. by tests or by a real deployment environment).
loadEnv({ quiet: true, override: false });

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
  REDIS_URL: z.string().url({ message: 'REDIS_URL must be a valid URL' }),
  JWT_SECRET: z
    .string({ error: 'JWT_SECRET is required' })
    .min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.coerce.number().int().positive().default(900),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
});

export type Config = z.infer<typeof envSchema>;

/**
 * Validates env and returns a typed config object.
 * On failure: logs which variables are invalid, then exits the process.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = envSchema.safeParse({
    PORT: env.PORT,
    REDIS_URL: env.REDIS_URL,
    JWT_SECRET: env.JWT_SECRET,
    JWT_EXPIRES_IN: env.JWT_EXPIRES_IN,
    NODE_ENV: env.NODE_ENV,
    LOG_LEVEL: env.LOG_LEVEL,
  });

  if (!result.success) {
    console.error('Invalid environment configuration. Fix the following and restart:');
    for (const issue of result.error.issues) {
      const key = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      console.error(`  - ${key}: ${issue.message}`);
    }
    process.exit(1);
  }

  return result.data;
}

export const config: Config = loadConfig();
