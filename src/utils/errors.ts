export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly isOperational: boolean;
  public readonly details?: string[];

  constructor(
    message: string,
    statusCode: number,
    errorCode: string,
    options?: { details?: string[]; isOperational?: boolean },
  ) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = options?.isOperational ?? true;
    this.details = options?.details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'The request failed validation.', details?: string[]) {
    super(message, 400, 'VALIDATION_ERROR', { details });
  }
}

export class WeakPasswordError extends AppError {
  constructor(message = 'The password does not meet complexity requirements.', details?: string[]) {
    super(message, 400, 'WEAK_PASSWORD', { details });
  }
}

export class UsernameTakenError extends AppError {
  constructor(message = 'That username is already taken.') {
    super(message, 409, 'USERNAME_TAKEN');
  }
}

export class InvalidCredentialsError extends AppError {
  constructor(message = 'Invalid username or password.') {
    super(message, 401, 'INVALID_CREDENTIALS');
  }
}

export class RateLimitedError extends AppError {
  constructor(message = 'Too many requests. Please try again later.') {
    super(message, 429, 'RATE_LIMITED');
  }
}
