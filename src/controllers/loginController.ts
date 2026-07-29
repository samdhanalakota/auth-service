import type { NextFunction, Request, Response } from 'express';
import { parseLoginRequest } from '../schemas/loginSchema';
import { loginUser } from '../services/loginService';

// All errors — validation, business logic, or unexpected — are forwarded to the error handler.
export async function loginHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const validated = parseLoginRequest(req.body);
    const result = await loginUser(validated);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
