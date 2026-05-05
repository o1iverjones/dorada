export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(code: string, message: string) {
    super(code, 404, message);
  }
}

export class ConflictError extends AppError {
  constructor(code: string, message: string) {
    super(code, 409, message);
  }
}

export class ValidationError extends AppError {
  constructor(code: string, message: string) {
    super(code, 422, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(code: string, message: string) {
    super(code, 401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(code: string, message: string) {
    super(code, 403, message);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(code: string, message: string) {
    super(code, 429, message);
  }
}
