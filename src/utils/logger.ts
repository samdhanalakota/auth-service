import pino, { type DestinationStream, type Logger, type LoggerOptions } from 'pino';
import { config } from '../config';

const SENSITIVE_KEY = /^(password|token|authorization|jwt_secret)$/i;
const REDACTED = '[Redacted]';

// Recursively replaces sensitive keys with "[Redacted]". Exported so tests can assert on it directly.
export function redactSensitive(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (value instanceof Error) {
    return {
      type: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, seen));
  }

  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    output[key] = SENSITIVE_KEY.test(key) ? REDACTED : redactSensitive(nested, seen);
  }
  return output;
}

// Pass an optional destination stream to capture output in tests.
// In non-production environments, pino-pretty is used for readable console output.
export function createLogger(destination?: DestinationStream): Logger {
  const options: LoggerOptions = {
    level: config.LOG_LEVEL,
    formatters: {
      log(object: Record<string, unknown>): Record<string, unknown> {
        return redactSensitive(object) as Record<string, unknown>;
      },
    },
  };

  if (config.NODE_ENV !== 'production' && destination === undefined) {
    options.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    };
  }

  return pino(options, destination);
}

export const logger: Logger = createLogger();
