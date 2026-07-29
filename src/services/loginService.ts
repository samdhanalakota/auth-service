import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { findUserByUsername } from '../repositories/userRepository';
import { config } from '../config';
import { InvalidCredentialsError } from '../utils/errors';

// A real Argon2id hash of a fixed string, computed once at module load.
// We verify against this when no user is found so that the response time for
// a missing username is indistinguishable from the time for a wrong password.
// Without this, an attacker can detect which usernames exist by measuring
// how quickly the server responds.
export const DUMMY_HASH =
  '$argon2id$v=19$m=19456,p=1,t=2$wERR3jQICYKZXCa/j9OyTg$RGyJANMXvh48wOYLFLbJmvZkeZkzj+QiLQBgx0Qt4hQ';

export interface LoginResult {
  token: string;
  expiresIn: number;
}

// InvalidCredentialsError and jwt/argon2 failures propagate up to the controller unchanged.
export async function loginUser(input: {
  username: string;
  password: string;
}): Promise<LoginResult> {
  const user = await findUserByUsername(input.username);

  if (user === null) {
    // Always run a hash verification even though we know this will fail, so
    // the response time matches a real wrong-password attempt.
    await argon2.verify(DUMMY_HASH, input.password);
    throw new InvalidCredentialsError();
  }

  const valid = await argon2.verify(user.passwordHash, input.password);

  if (!valid) {
    throw new InvalidCredentialsError();
  }

  const token = jwt.sign({ username: input.username }, config.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: config.JWT_EXPIRES_IN,
  });

  return { token, expiresIn: config.JWT_EXPIRES_IN };
}
