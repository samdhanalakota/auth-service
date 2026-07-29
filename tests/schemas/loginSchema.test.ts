import { describe, expect, it } from '@jest/globals';
import { parseLoginRequest } from '../../src/schemas/loginSchema';
import { ValidationError } from '../../src/utils/errors';

function attempt(body: unknown): unknown {
  try {
    parseLoginRequest(body);
    return undefined;
  } catch (e) {
    return e;
  }
}

describe('parseLoginRequest', () => {
  it('accepts valid input and lowercases the username', () => {
    const result = parseLoginRequest({ username: 'Alice', password: 'any-password' });
    expect(result).toEqual({ username: 'alice', password: 'any-password' });
  });

  it('throws ValidationError when username is missing', () => {
    expect(attempt({ password: 'any-password' })).toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when password is missing', () => {
    expect(attempt({ username: 'alice' })).toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when username is an empty string', () => {
    expect(attempt({ username: '', password: 'any-password' })).toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when password is an empty string', () => {
    expect(attempt({ username: 'alice', password: '' })).toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when the body contains an extra unexpected field', () => {
    expect(
      attempt({ username: 'alice', password: 'any-password', role: 'admin' }),
    ).toBeInstanceOf(ValidationError);
  });

  it('does not enforce password complexity — a weak-looking password still passes', () => {
    const result = parseLoginRequest({ username: 'alice', password: 'short' });
    expect(result.password).toBe('short');
  });
});
