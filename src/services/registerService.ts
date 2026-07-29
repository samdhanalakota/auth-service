import argon2 from 'argon2';
import { createUser } from '../repositories/userRepository';

// OWASP recommended minimum parameters for Argon2id as of 2023:
// https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export interface RegisterResult {
  username: string;
  createdAt: string;
}

/**
 * Registers a new user.
 *
 * Hashes the password with Argon2id, then persists the user via the repository.
 * Returns only the public-safe fields — the hash never leaves this function.
 *
 * UsernameTakenError from createUser propagates to the caller as-is; it is
 * the controller's job to map that to an HTTP response.
 * Any unexpected argon2 failure also propagates and will surface as a 500.
 */
export async function registerUser(input: {
  username: string;
  password: string;
}): Promise<RegisterResult> {
  const passwordHash = await argon2.hash(input.password, ARGON2_OPTIONS);

  const stored = await createUser(input.username, passwordHash);

  return {
    username: input.username,
    createdAt: stored.createdAt,
  };
}
