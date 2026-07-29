import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { NextFunction, Request, Response } from 'express';

jest.mock('../../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import { errorHandler, notFoundHandler } from '../../src/middleware/errorHandler';
import { logger } from '../../src/utils/logger';
import {
  InvalidCredentialsError,
  RateLimitedError,
  UsernameTakenError,
  ValidationError,
  WeakPasswordError,
} from '../../src/utils/errors';

interface MockResponse extends Response {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
}

function createMockResponse(requestId = 'test-request-id'): MockResponse {
  const headers: Record<string, string> = {
    'X-Request-Id': requestId,
  };

  const res = {
    locals: { requestId },
    statusCode: 200,
    body: undefined as unknown,
    headers,
    status(code: number): MockResponse {
      res.statusCode = code;
      return res as unknown as MockResponse;
    },
    json(payload: unknown): MockResponse {
      res.body = payload;
      return res as unknown as MockResponse;
    },
    setHeader(name: string, value: string | number | readonly string[]): MockResponse {
      headers[name] = String(value);
      return res as unknown as MockResponse;
    },
  };

  return res as unknown as MockResponse;
}

describe('errorHandler', () => {
  const req = { method: 'POST', path: '/api/v1/login' } as Request;
  const next = jest.fn() as NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    {
      name: 'ValidationError',
      error: new ValidationError('Invalid fields.', ['username is required']),
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Invalid fields.',
      details: ['username is required'],
    },
    {
      name: 'WeakPasswordError',
      error: new WeakPasswordError('Weak password.', ['too short']),
      status: 400,
      code: 'WEAK_PASSWORD',
      message: 'Weak password.',
      details: ['too short'],
    },
    {
      name: 'UsernameTakenError',
      error: new UsernameTakenError(),
      status: 409,
      code: 'USERNAME_TAKEN',
      message: 'That username is already taken.',
    },
    {
      name: 'InvalidCredentialsError',
      error: new InvalidCredentialsError(),
      status: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid username or password.',
    },
    {
      name: 'RateLimitedError',
      error: new RateLimitedError(),
      status: 429,
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please try again later.',
    },
  ])('maps $name to the correct status and body', ({ error, status, code, message, details }) => {
    const res = createMockResponse();

    errorHandler(error, req, res, next);

    expect(res.statusCode).toBe(status);
    expect(res.body).toEqual({
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
    });
    expect(res.headers['X-Request-Id']).toBe('test-request-id');
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('maps unexpected errors to a generic 500 without leaking details', () => {
    const res = createMockResponse();
    const unexpected = new Error('database password is hunter2');

    errorHandler(unexpected, req, res, next);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong',
      },
    });
    expect(JSON.stringify(res.body)).not.toContain('hunter2');
    expect(logger.error).toHaveBeenCalled();
    expect(res.headers['X-Request-Id']).toBe('test-request-id');
  });
});

describe('notFoundHandler', () => {
  it('returns a 404 NOT_FOUND envelope', () => {
    const req = { method: 'GET', path: '/missing' } as Request;
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    notFoundHandler(req, res, next);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'No matching route was found for this request.',
      },
    });
    expect(next).not.toHaveBeenCalled();
  });
});
