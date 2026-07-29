import { afterEach, describe, expect, it, jest } from '@jest/globals';

const ENV_KEYS = [
  'PORT',
  'REDIS_URL',
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
  'NODE_ENV',
  'LOG_LEVEL',
] as const;

const VALID_ENV: Record<(typeof ENV_KEYS)[number], string> = {
  PORT: '3000',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'a'.repeat(32),
  JWT_EXPIRES_IN: '900',
  NODE_ENV: 'test',
  LOG_LEVEL: 'info',
};

describe('config', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  function applyEnv(overrides: Record<string, string | undefined>): void {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) {
        // Set to empty string rather than deleting the key. dotenv uses
        // override:false, so it only fills in absent keys. An empty string
        // is present, so dotenv won't repopulate it from the .env file,
        // and Zod's min(32) check fires as intended.
        process.env[key] = '';
      } else {
        process.env[key] = value;
      }
    }
  }

  function loadConfigModule(): typeof import('../../src/config/index') {
    let mod: typeof import('../../src/config/index') | undefined;
    jest.isolateModules(() => {
      // Fresh load so module-level loadConfig() runs against the current env.
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- isolateModules needs sync require
      mod = require('../../src/config/index') as typeof import('../../src/config/index');
    });
    if (mod === undefined) {
      throw new Error('Failed to load config module');
    }
    return mod;
  }

  it('valid env passes', () => {
    applyEnv(VALID_ENV);

    const { config } = loadConfigModule();

    expect(config).toEqual({
      PORT: 3000,
      REDIS_URL: 'redis://localhost:6379',
      JWT_SECRET: 'a'.repeat(32),
      JWT_EXPIRES_IN: 900,
      NODE_ENV: 'test',
      LOG_LEVEL: 'info',
    });
  });

  it('missing JWT_SECRET fails', () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${String(code)}`);
    }) as never);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    applyEnv({ ...VALID_ENV, JWT_SECRET: undefined });

    expect(() => loadConfigModule()).toThrow('process.exit:1');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('JWT_SECRET under 32 chars fails', () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${String(code)}`);
    }) as never);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    applyEnv({ ...VALID_ENV, JWT_SECRET: 'too-short-secret' });

    expect(() => loadConfigModule()).toThrow('process.exit:1');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy.mock.calls.flat().join('\n')).toMatch(/JWT_SECRET/);
  });
});
