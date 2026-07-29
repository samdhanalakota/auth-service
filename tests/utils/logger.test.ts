import { Writable } from 'node:stream';
import { describe, expect, it } from '@jest/globals';
import { createLogger, redactSensitive } from '../../src/utils/logger';

describe('logger', () => {
  it('redacts password fields case-insensitively in helper', () => {
    const result = redactSensitive({
      password: 'super-secret',
      Password: 'AlsoSecret',
      user: 'sam',
      nested: { TOKEN: 'tok123', authorization: 'Bearer abc' },
    }) as Record<string, unknown>;

    expect(result['password']).toBe('[Redacted]');
    expect(result['Password']).toBe('[Redacted]');
    expect(result['user']).toBe('sam');
    expect((result['nested'] as Record<string, unknown>)['TOKEN']).toBe('[Redacted]');
    expect((result['nested'] as Record<string, unknown>)['authorization']).toBe('[Redacted]');
  });

  it('does not write password values in plain text when logging', async () => {
    const chunks: string[] = [];
    const destination = new Writable({
      write(chunk: Buffer | string, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
        chunks.push(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
        callback();
      },
    });

    const log = createLogger(destination);
    log.info(
      {
        password: 'super-secret-value',
        jwt_secret: 'should-also-hide',
        username: 'alice',
      },
      'login attempt',
    );

    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });

    const output = chunks.join('');
    expect(output).toContain('login attempt');
    expect(output).toContain('alice');
    expect(output).toContain('[Redacted]');
    expect(output).not.toContain('super-secret-value');
    expect(output).not.toContain('should-also-hide');
  });
});
