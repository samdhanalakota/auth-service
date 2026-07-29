import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import jwt from 'jsonwebtoken';

jest.mock('../../src/repositories/userRepository');
jest.mock('argon2');

import { DUMMY_HASH, loginUser } from '../../src/services/loginService';
import { findUserByUsername } from '../../src/repositories/userRepository';
import argon2 from 'argon2';
import { InvalidCredentialsError } from '../../src/utils/errors';

const mockFindUser = findUserByUsername as jest.MockedFunction<typeof findUserByUsername>;
const mockVerify = argon2.verify as jest.MockedFunction<typeof argon2.verify>;

const STORED_USER = {
  passwordHash: '$argon2id$v=19$m=19456,p=1,t=2$fake$fakehash',
  createdAt: '2024-01-01T00:00:00.000Z',
};

const JWT_SECRET = process.env['JWT_SECRET'] ?? '';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('loginUser', () => {
  it('returns a valid JWT and expiresIn on correct credentials', async () => {
    mockFindUser.mockResolvedValue(STORED_USER);
    mockVerify.mockResolvedValue(true);

    const result = await loginUser({ username: 'alice', password: 'Correct-Horse!9' });

    expect(result.token).toBeTruthy();
    expect(typeof result.expiresIn).toBe('number');

    const decoded = jwt.verify(result.token, JWT_SECRET, { algorithms: ['HS256'] }) as {
      username: string;
    };
    expect(decoded.username).toBe('alice');
  });

  it('uses HS256 algorithm in the issued token', async () => {
    mockFindUser.mockResolvedValue(STORED_USER);
    mockVerify.mockResolvedValue(true);

    const result = await loginUser({ username: 'alice', password: 'Correct-Horse!9' });

    const header = jwt.decode(result.token, { complete: true })?.header;
    expect(header?.alg).toBe('HS256');
  });

  it('returns expiresIn matching config.JWT_EXPIRES_IN', async () => {
    mockFindUser.mockResolvedValue(STORED_USER);
    mockVerify.mockResolvedValue(true);

    const result = await loginUser({ username: 'alice', password: 'Correct-Horse!9' });

    // The test env sets JWT_EXPIRES_IN=900 via tests/setupEnv.ts
    expect(result.expiresIn).toBe(900);
  });

  it('throws InvalidCredentialsError on wrong password', async () => {
    mockFindUser.mockResolvedValue(STORED_USER);
    mockVerify.mockResolvedValue(false);

    await expect(loginUser({ username: 'alice', password: 'wrong' })).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
  });

  it('throws InvalidCredentialsError when the user does not exist', async () => {
    mockFindUser.mockResolvedValue(null);
    mockVerify.mockResolvedValue(false);

    await expect(loginUser({ username: 'ghost', password: 'any' })).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
  });

  it('produces the same error message for a missing user as for a wrong password', async () => {
    mockFindUser.mockResolvedValue(null);
    mockVerify.mockResolvedValue(false);
    let missingUserError: InvalidCredentialsError | undefined;
    try {
      await loginUser({ username: 'ghost', password: 'any' });
    } catch (e) {
      missingUserError = e as InvalidCredentialsError;
    }

    mockFindUser.mockResolvedValue(STORED_USER);
    mockVerify.mockResolvedValue(false);
    let wrongPasswordError: InvalidCredentialsError | undefined;
    try {
      await loginUser({ username: 'alice', password: 'wrong' });
    } catch (e) {
      wrongPasswordError = e as InvalidCredentialsError;
    }

    expect(missingUserError?.message).toBe(wrongPasswordError?.message);
  });

  it('still calls argon2.verify with the dummy hash when the user is not found', async () => {
    mockFindUser.mockResolvedValue(null);
    mockVerify.mockResolvedValue(false);

    await expect(loginUser({ username: 'ghost', password: 'any' })).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );

    expect(mockVerify).toHaveBeenCalledTimes(1);
    expect(mockVerify).toHaveBeenCalledWith(DUMMY_HASH, 'any');
  });
});
