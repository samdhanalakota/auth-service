import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: string[];
  };
}

function buildErrorBody(code: string, message: string, details?: string[]): ErrorBody {
  const body: ErrorBody = {
    error: {
      code,
      message,
    },
  };
  if (details !== undefined && details.length > 0) {
    body.error.details = details;
  }
  return body;
}

// Known AppErrors get their status code and error envelope. Anything else is logged and returned as 500.
export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const requestId = res.locals.requestId;

  if (err instanceof AppError) {
    res.status(err.statusCode).json(buildErrorBody(err.errorCode, err.message, err.details));
    return;
  }

  logger.error(
    {
      err,
      requestId,
      method: req.method,
      path: req.path,
    },
    'An unexpected error occurred while handling the request.',
  );

  res.status(500).json(
    buildErrorBody('INTERNAL_ERROR', 'Something went wrong'),
  );
};

export const notFoundHandler: RequestHandler = (_req: Request, res: Response): void => {
  res.status(404).json(
    buildErrorBody('NOT_FOUND', 'No matching route was found for this request.'),
  );
};
