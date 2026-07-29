import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('ioredis', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-return -- jest mock factory needs sync require
  return require('ioredis-mock');
});

jest.mock('../../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

import { redisClient } from '../../src/repositories/redisClient';
import { createUser, findUserByUsername } from '../../src/repositories/userRepository';
import { UsernameTakenError } from '../../src/utils/errors';
import { logger } from '../../src/utils/logger';

const TEST_USERNAME = 'alice';
const TEST_HASH = '$argon2id$test-hash-value';

describe('userRepository', () => {
  beforeEach(async () => {
    await redisClient.flushall();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    it('creates a user and returns a StoredUser with the correct shape', async () => {
      const before = new Date();
      const user = await createUser(TEST_USERNAME, TEST_HASH);
      const after = new Date();

      expect(user.passwordHash).toBe(TEST_HASH);
      expect(new Date(user.createdAt).getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(new Date(user.createdAt).getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('persists the user so it can be retrieved afterward', async () => {
      await createUser(TEST_USERNAME, TEST_HASH);
      const found = await findUserByUsername(TEST_USERNAME);
      expect(found).not.toBeNull();
      expect(found?.passwordHash).toBe(TEST_HASH);
    });

    it('throws UsernameTakenError when the username already exists', async () => {
      await createUser(TEST_USERNAME, TEST_HASH);
      await expect(createUser(TEST_USERNAME, TEST_HASH)).rejects.toBeInstanceOf(UsernameTakenError);
    });

    it('allows two different usernames to be created independently', async () => {
      const a = await createUser('alice', TEST_HASH);
      const b = await createUser('bob', TEST_HASH);
      expect(a.passwordHash).toBe(TEST_HASH);
      expect(b.passwordHash).toBe(TEST_HASH);
    });
  });

  describe('findUserByUsername', () => {
    it('returns null for a username that does not exist', async () => {
      const result = await findUserByUsername('nobody');
      expect(result).toBeNull();
    });

    it('returns the stored user for an existing username', async () => {
      await createUser(TEST_USERNAME, TEST_HASH);
      const user = await findUserByUsername(TEST_USERNAME);
      expect(user).not.toBeNull();
      expect(user?.passwordHash).toBe(TEST_HASH);
      expect(typeof user?.createdAt).toBe('string');
    });

    it('returns null and logs an error when the stored value is malformed JSON', async () => {
      // Seed Redis directly with a bad value to simulate corruption.
      await redisClient.set(`user:${TEST_USERNAME}`, 'not-valid-json');

      const result = await findUserByUsername(TEST_USERNAME);

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(
        (logger.error as jest.MockedFunction<typeof logger.error>).mock.calls[0]?.[1],
      ).toMatch(/malformed JSON/i);
    });
  });
});
