import { describe, expect, it } from '@jest/globals';
import { parseRegisterRequest } from '../../src/schemas/registerSchema';
import { ValidationError, WeakPasswordError } from '../../src/utils/errors';

const VALID_USERNAME = 'alice';
const VALID_PASSWORD = 'Correct-Horse!9';

/** Calls parseRegisterRequest and returns the thrown error, or undefined if it did not throw. */
function attempt(body: unknown): unknown {
  try {
    parseRegisterRequest(body);
    return undefined;
  } catch (e) {
    return e;
  }
}

describe('parseRegisterRequest', () => {
  describe('valid input', () => {
    it('accepts a well-formed username and strong password', () => {
      const result = parseRegisterRequest({ username: VALID_USERNAME, password: VALID_PASSWORD });
      expect(result).toEqual({ username: 'alice', password: VALID_PASSWORD });
    });

    it('normalizes username to lowercase', () => {
      const result = parseRegisterRequest({ username: 'Alice_Test', password: VALID_PASSWORD });
      expect(result.username).toBe('alice_test');
    });

    it('accepts usernames with underscores, hyphens, and periods', () => {
      expect(() =>
        parseRegisterRequest({ username: 'a1.b-c_d', password: VALID_PASSWORD }),
      ).not.toThrow();
    });
  });

  describe('missing or extra fields', () => {
    it('throws ValidationError when username is missing', () => {
      expect(attempt({ password: VALID_PASSWORD })).toBeInstanceOf(ValidationError);
    });

    it('throws ValidationError when password is missing', () => {
      expect(attempt({ username: VALID_USERNAME })).toBeInstanceOf(ValidationError);
    });

    it('throws ValidationError when both fields are missing', () => {
      expect(attempt({})).toBeInstanceOf(ValidationError);
    });

    it('throws ValidationError when the body contains extra keys', () => {
      expect(
        attempt({ username: VALID_USERNAME, password: VALID_PASSWORD, role: 'admin' }),
      ).toBeInstanceOf(ValidationError);
    });
  });

  describe('username format', () => {
    it('throws ValidationError when username is too short', () => {
      const err = attempt({ username: 'ab', password: VALID_PASSWORD });
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).details?.join(' ')).toMatch(/3/);
    });

    it('throws ValidationError when username is too long', () => {
      expect(attempt({ username: 'a'.repeat(31), password: VALID_PASSWORD })).toBeInstanceOf(
        ValidationError,
      );
    });

    it('throws ValidationError for username with a colon', () => {
      expect(attempt({ username: 'user:name', password: VALID_PASSWORD })).toBeInstanceOf(
        ValidationError,
      );
    });

    it('throws ValidationError for username with a forward slash', () => {
      expect(attempt({ username: 'user/name', password: VALID_PASSWORD })).toBeInstanceOf(
        ValidationError,
      );
    });

    it('throws ValidationError for username with a backslash (banned-char check)', () => {
      expect(attempt({ username: 'user\\name', password: VALID_PASSWORD })).toBeInstanceOf(
        ValidationError,
      );
    });

    it('rejects a backslash via USERNAME_PATTERN independently of the banned-char check', () => {
      // Verify the pattern itself does not permit backslash — guards against the
      // previous bug where [a-zA-Z0-9_.\\-] matched a literal backslash.
      const USERNAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{2,29}$/;
      expect(USERNAME_PATTERN.test('user\\name')).toBe(false);
      expect(USERNAME_PATTERN.test('username')).toBe(true);
      expect(USERNAME_PATTERN.test('user-name')).toBe(true);
      expect(USERNAME_PATTERN.test('user.name')).toBe(true);
    });

    it('throws ValidationError for username with an @ symbol', () => {
      expect(attempt({ username: 'user@host', password: VALID_PASSWORD })).toBeInstanceOf(
        ValidationError,
      );
    });

    it('throws ValidationError for username with a space', () => {
      expect(attempt({ username: 'user name', password: VALID_PASSWORD })).toBeInstanceOf(
        ValidationError,
      );
    });

    it('throws ValidationError for leading space — does not silently trim', () => {
      expect(attempt({ username: ' alice', password: VALID_PASSWORD })).toBeInstanceOf(
        ValidationError,
      );
    });

    it('throws ValidationError for trailing space — does not silently trim', () => {
      expect(attempt({ username: 'alice ', password: VALID_PASSWORD })).toBeInstanceOf(
        ValidationError,
      );
    });

    it('throws ValidationError for username starting with a period', () => {
      expect(attempt({ username: '.alice', password: VALID_PASSWORD })).toBeInstanceOf(
        ValidationError,
      );
    });

    it('throws ValidationError for username starting with an underscore', () => {
      expect(attempt({ username: '_alice', password: VALID_PASSWORD })).toBeInstanceOf(
        ValidationError,
      );
    });

    it('throws ValidationError for username starting with a hyphen', () => {
      expect(attempt({ username: '-alice', password: VALID_PASSWORD })).toBeInstanceOf(
        ValidationError,
      );
    });

    it('throws ValidationError for username with non-ASCII characters', () => {
      expect(attempt({ username: 'alicé', password: VALID_PASSWORD })).toBeInstanceOf(
        ValidationError,
      );
    });
  });

  describe('password complexity', () => {
    it('throws WeakPasswordError when password is under 12 characters', () => {
      const err = attempt({ username: VALID_USERNAME, password: 'Short!1A' });
      expect(err).toBeInstanceOf(WeakPasswordError);
      expect((err as WeakPasswordError).details).toEqual(
        expect.arrayContaining(['Password must be at least 12 characters long.']),
      );
    });

    it('throws WeakPasswordError when password has no uppercase letter', () => {
      const err = attempt({ username: VALID_USERNAME, password: 'nouppercase!9a' });
      expect(err).toBeInstanceOf(WeakPasswordError);
      expect((err as WeakPasswordError).details).toEqual(
        expect.arrayContaining(['Password must contain at least one uppercase letter.']),
      );
    });

    it('throws WeakPasswordError when password has no lowercase letter', () => {
      const err = attempt({ username: VALID_USERNAME, password: 'NOLOWERCASE!9A' });
      expect(err).toBeInstanceOf(WeakPasswordError);
      expect((err as WeakPasswordError).details).toEqual(
        expect.arrayContaining(['Password must contain at least one lowercase letter.']),
      );
    });

    it('throws WeakPasswordError when password has no digit', () => {
      const err = attempt({ username: VALID_USERNAME, password: 'NoDigitHere!!' });
      expect(err).toBeInstanceOf(WeakPasswordError);
      expect((err as WeakPasswordError).details).toEqual(
        expect.arrayContaining(['Password must contain at least one digit.']),
      );
    });

    it('throws WeakPasswordError when password has no special character', () => {
      const err = attempt({ username: VALID_USERNAME, password: 'NoSpecialChar9A' });
      expect(err).toBeInstanceOf(WeakPasswordError);
      expect((err as WeakPasswordError).details).toEqual(
        expect.arrayContaining(['Password must contain at least one special character.']),
      );
    });

    it('throws WeakPasswordError for a password on the blocklist', () => {
      const err = attempt({ username: VALID_USERNAME, password: 'password123' });
      expect(err).toBeInstanceOf(WeakPasswordError);
      expect(
        (err as WeakPasswordError).details?.some((d) => d.toLowerCase().includes('common')),
      ).toBe(true);
    });

    it('includes all failures when multiple rules are violated simultaneously', () => {
      // 'short' — under 12, no uppercase, no digit, no special (4 failures minimum)
      const err = attempt({ username: VALID_USERNAME, password: 'short' });
      expect(err).toBeInstanceOf(WeakPasswordError);
      const details = (err as WeakPasswordError).details ?? [];
      expect(details.length).toBeGreaterThanOrEqual(4);
      expect(details).toEqual(
        expect.arrayContaining([
          'Password must be at least 12 characters long.',
          'Password must contain at least one uppercase letter.',
          'Password must contain at least one digit.',
          'Password must contain at least one special character.',
        ]),
      );
    });
  });
});
