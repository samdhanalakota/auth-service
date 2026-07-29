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

// Hashes the password with Argon2id, then persists the user.
// The hash never leaves this function — only username and createdAt are returned.
// UsernameTakenError and argon2 failures propagate up to the controller unchanged.
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
