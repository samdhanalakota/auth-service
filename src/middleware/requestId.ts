import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const REQUEST_ID_HEADER = 'X-Request-Id';

function readIncomingRequestId(req: Request): string | undefined {
  const header = req.headers['x-request-id'];
  if (typeof header === 'string') {
    const trimmed = header.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (Array.isArray(header) && header.length > 0) {
    const first = header[0]?.trim();
    return first !== undefined && first.length > 0 ? first : undefined;
  }
  return undefined;
}

// Reuses an incoming X-Request-Id when present, otherwise generates a new UUID.
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = readIncomingRequestId(req) ?? randomUUID();
  res.locals.requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}
