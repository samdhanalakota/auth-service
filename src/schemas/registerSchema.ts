import { z } from 'zod';
import { ValidationError, WeakPasswordError } from '../utils/errors';

// Matches the full allowed username: starts with letter or digit, followed by
// 2–29 more characters that are letters, digits, underscore, period, or hyphen.
// Hyphen is placed last in the character class so it is treated as a literal,
// not as a range operator.
const USERNAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{2,29}$/;

// Any explicitly banned character per the spec.
const USERNAME_BANNED = /[:\/\\@ \t\r\n]/;

// Any non-ASCII character.
const NON_ASCII = /[^\x00-\x7F]/;

// A small representative blocklist — not exhaustive, intended to catch the
// most obvious weak passwords before they reach the database.
const COMMON_PASSWORD_BLOCKLIST = new Set([
  'password123456',
  'password123',
  'qwertyuiop',
  'qwerty123456',
  'letmein123456',
  'welcome123456',
  'monkey123456',
  'dragon123456',
  'master123456',
  'admin123456',
]);

export const registerRequestSchema = z
  .object({
    username: z
      .string({ error: 'Username is required.' })
      .refine((v) => !USERNAME_BANNED.test(v) && !NON_ASCII.test(v), {
        message:
          'Username contains a banned character. Allowed characters are letters, digits, underscore, hyphen, and period.',
      })
      .refine((v) => v.length >= 3 && v.length <= 30, {
        message: 'Username must be between 3 and 30 characters.',
      })
      .refine((v) => USERNAME_PATTERN.test(v), {
        message:
          'Username must start with a letter or digit and contain only letters, digits, underscore, hyphen, or period.',
      })
      .transform((v) => v.toLowerCase()),
    password: z.string({ error: 'Password is required.' }),
  })
  .strict();

export type RegisterRequest = z.infer<typeof registerRequestSchema>;

// Collects every failing rule so the caller can report all violations at once.
function collectPasswordFailures(password: string): string[] {
  const failures: string[] = [];

  if (password.length < 12) {
    failures.push('Password must be at least 12 characters long.');
  }
  if (!/[A-Z]/.test(password)) {
    failures.push('Password must contain at least one uppercase letter.');
  }
  if (!/[a-z]/.test(password)) {
    failures.push('Password must contain at least one lowercase letter.');
  }
  if (!/[0-9]/.test(password)) {
    failures.push('Password must contain at least one digit.');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    failures.push('Password must contain at least one special character.');
  }
  if (COMMON_PASSWORD_BLOCKLIST.has(password.toLowerCase())) {
    failures.push('This password is too common. Please choose a less predictable one.');
  }

  return failures;
}

// Throws ValidationError for structural problems (missing fields, bad username, extra keys).
// Throws WeakPasswordError with all failing rules when the password is weak.
// Returns the validated body with username normalized to lowercase on success.
export function parseRegisterRequest(body: unknown): RegisterRequest {
  const result = registerRequestSchema.safeParse(body);

  if (!result.success) {
    const details = result.error.issues.map((issue) => issue.message);
    throw new ValidationError('The request body is invalid.', details);
  }

  const passwordFailures = collectPasswordFailures(result.data.password);
  if (passwordFailures.length > 0) {
    throw new WeakPasswordError(
      'The password does not meet the complexity requirements.',
      passwordFailures,
    );
  }

  return result.data;
}
