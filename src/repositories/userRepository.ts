import { UsernameTakenError } from '../utils/errors';
import { logger } from '../utils/logger';
import { redisClient } from './redisClient';

export interface StoredUser {
  passwordHash: string;
  createdAt: string; // ISO 8601
}

function userKey(username: string): string {
  return `user:${username}`;
}

/**
 * Persists a new user atomically using SET NX.
 * The username is expected to be already normalized to lowercase by the caller.
 * Throws UsernameTakenError if the key already exists — no separate EXISTS check,
 * since that would reintroduce the race condition the NX flag prevents.
 */
export async function createUser(
  username: string,
  passwordHash: string,
): Promise<StoredUser> {
  const user: StoredUser = {
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  const result = await redisClient.set(userKey(username), JSON.stringify(user), 'NX');

  if (result === null) {
    throw new UsernameTakenError();
  }

  return user;
}

/**
 * Looks up a user by username.
 * The username is expected to be already normalized to lowercase by the caller.
 * Returns null when no user exists with that username.
 * Returns null and logs an error if the stored value is not valid JSON — this
 * should never happen in normal operation, but we defend against it rather than
 * crashing the request.
 */
export async function findUserByUsername(username: string): Promise<StoredUser | null> {
  const raw = await redisClient.get(userKey(username));

  if (raw === null) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    logger.error(
      { username },
      'Found malformed JSON in Redis for a user key. Treating the user as not found.',
    );
    return null;
  }
}
