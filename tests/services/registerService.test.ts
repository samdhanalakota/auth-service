import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import argon2 from 'argon2';

jest.mock('../../src/repositories/userRepository', () => ({
  createUser: jest.fn(),
}));

import { createUser } from '../../src/repositories/userRepository';
import { registerUser } from '../../src/services/registerService';
import { UsernameTakenError } from '../../src/utils/errors';

const mockCreateUser = createUser as jest.MockedFunction<typeof createUser>;

const VALID_INPUT = { username: 'alice', password: 'Correct-Horse!9' };
const FAKE_STORED = { passwordHash: '$argon2id$fake', createdAt: '2024-01-01T00:00:00.000Z' };

describe('registerService', () => {
  beforeEach(() => {
    mockCreateUser.mockReset();
  });

  it('hashes the password and passes the hash (not the plaintext) to createUser', async () => {
    mockCreateUser.mockResolvedValueOnce(FAKE_STORED);

    await registerUser(VALID_INPUT);

    expect(mockCreateUser).toHaveBeenCalledTimes(1);
    const [calledUsername, calledHash] = mockCreateUser.mock.calls[0] as [string, string];

    expect(calledUsername).toBe(VALID_INPUT.username);
    // The hash must not be the raw plaintext password.
    expect(calledHash).not.toBe(VALID_INPUT.password);
    // It should be a real argon2id hash string.
    expect(calledHash).toMatch(/^\$argon2id\$/);
  });

  it('uses argon2id specifically, not argon2i or argon2d', async () => {
    mockCreateUser.mockResolvedValueOnce(FAKE_STORED);

    const hashSpy = jest.spyOn(argon2, 'hash');
    await registerUser(VALID_INPUT);

    const options = hashSpy.mock.calls[0]?.[1] as { type?: number } | undefined;
    expect(options?.type).toBe(argon2.argon2id);

    hashSpy.mockRestore();
  });

  it('returns only { username, createdAt } — no passwordHash in the result', async () => {
    mockCreateUser.mockResolvedValueOnce(FAKE_STORED);

    const result = await registerUser(VALID_INPUT);

    expect(result).toEqual({ username: VALID_INPUT.username, createdAt: FAKE_STORED.createdAt });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('propagates UsernameTakenError when createUser rejects with it', async () => {
    mockCreateUser.mockRejectedValueOnce(new UsernameTakenError());

    await expect(registerUser(VALID_INPUT)).rejects.toBeInstanceOf(UsernameTakenError);
  });
});
