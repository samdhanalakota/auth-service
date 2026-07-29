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

// Uses SET NX for atomic uniqueness — no separate EXISTS check, which would introduce a race condition.
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

// Returns null if the user does not exist. Logs and returns null on malformed JSON rather than crashing.
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
