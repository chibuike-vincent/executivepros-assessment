import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error';
import {
  PaymentNotFoundError,
  PersistenceError,
  StalePaymentError,
} from '../repositories/errors';

function zodDetails(err: ZodError) {
  return err.issues.map((issue) => ({
    path: issue.path.join('.') || 'body',
    message: issue.message,
  }));
}

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        details: zodDetails(err),
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
    return;
  }

  if (err instanceof PaymentNotFoundError) {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: err.message,
      },
    });
    return;
  }

  if (err instanceof StalePaymentError) {
    res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: err.message,
      },
    });
    return;
  }

  if (err instanceof PersistenceError) {
    req.log?.error({ err }, 'Payment persistence failure');
    res.status(503).json({
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Payment store is temporarily unavailable',
      },
    });
    return;
  }

  const isSyntaxError = err instanceof SyntaxError && 'body' in err;
  if (isSyntaxError) {
    res.status(400).json({
      error: {
        code: 'INVALID_JSON',
        message: 'Request body must be valid JSON',
      },
    });
    return;
  }

  req.log?.error({ err }, 'Unhandled application error');
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
};
