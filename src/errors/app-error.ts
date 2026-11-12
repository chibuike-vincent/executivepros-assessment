export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class IllegalTransitionError extends AppError {
  constructor(
    public readonly currentStatus: string,
    public readonly nextStatus: string,
  ) {
    super(
      409,
      'ILLEGAL_STATUS_TRANSITION',
      `Cannot transition payment from ${currentStatus} to ${nextStatus}`,
      { currentStatus, nextStatus },
    );
    this.name = 'IllegalTransitionError';
  }
}

export class IdempotencyConflictError extends AppError {
  constructor(public readonly merchantRef: string) {
    super(
      409,
      'IDEMPOTENCY_CONFLICT',
      `Idempotency key ${merchantRef} was reused with a different payment payload`,
    );
    this.name = 'IdempotencyConflictError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, 'VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
  }
}
