import type { NextFunction, Request, Response } from 'express';
import { parseRegisterRequest } from '../schemas/registerSchema';
import { registerUser } from '../services/registerService';

// All errors — validation, business logic, or unexpected — are forwarded to the error handler.
export async function registerHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const validated = parseRegisterRequest(req.body);
    const result = await registerUser(validated);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}
