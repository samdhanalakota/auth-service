import { z } from 'zod';
import { ValidationError } from '../utils/errors';

// Login validation is intentionally minimal. Format and complexity rules belong
// at registration only — applying them here would leak whether a username looks
// valid vs. whether credentials are wrong, which weakens enumeration protection.
export const loginRequestSchema = z
  .object({
    username: z
      .string({ error: 'Username is required.' })
      .min(1, 'Username is required.')
      .transform((v) => v.toLowerCase()),
    password: z
      .string({ error: 'Password is required.' })
      .min(1, 'Password is required.'),
  })
  .strict();

export type LoginRequest = z.infer<typeof loginRequestSchema>;

// Throws ValidationError for missing, empty, or unexpected fields.
// Returns the validated body with username normalized to lowercase on success.
export function parseLoginRequest(body: unknown): LoginRequest {
  const result = loginRequestSchema.safeParse(body);

  if (!result.success) {
    const details = result.error.issues.map((issue) => issue.message);
    throw new ValidationError('The request body is invalid.', details);
  }

  return result.data;
}
