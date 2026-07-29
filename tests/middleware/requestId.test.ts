import { describe, expect, it, jest } from '@jest/globals';
import type { NextFunction, Request, Response } from 'express';
import { requestIdMiddleware } from '../../src/middleware/requestId';

function createMockResponse(): Response & { headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  const res = {
    locals: {} as Record<string, unknown>,
    headers,
    setHeader(name: string, value: string | number | readonly string[]): Response {
      headers[name] = String(value);
      return res as unknown as Response;
    },
  };
  return res as unknown as Response & { headers: Record<string, string> };
}

describe('requestIdMiddleware', () => {
  it('generates a UUID when no X-Request-Id header is present', () => {
    const req = { headers: {} } as Request;
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    requestIdMiddleware(req, res, next);

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(res.locals.requestId).toMatch(uuidPattern);
    expect(res.headers['X-Request-Id']).toBe(res.locals.requestId);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('reuses an incoming X-Request-Id header when present', () => {
    const incomingId = 'client-provided-request-id-123';
    const req = {
      headers: { 'x-request-id': incomingId },
    } as unknown as Request;
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    requestIdMiddleware(req, res, next);

    expect(res.locals.requestId).toBe(incomingId);
    expect(res.headers['X-Request-Id']).toBe(incomingId);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
