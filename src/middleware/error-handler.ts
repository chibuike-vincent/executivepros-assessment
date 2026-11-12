import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error';
import { sendError } from '../http/error-response';
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

function isPayloadTooLarge(err: unknown): boolean {
  if (!err || typeof err !== 'object') {
    return false;
  }

  const candidate = err as { status?: number; type?: string };
  return candidate.status === 413 || candidate.type === 'entity.too.large';
}

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof ZodError) {
    sendError(req, res, 400, 'VALIDATION_ERROR', 'Invalid request', zodDetails(err));
    return;
  }

  if (err instanceof AppError) {
    sendError(req, res, err.statusCode, err.code, err.message, err.details);
    return;
  }

  if (err instanceof PaymentNotFoundError) {
    sendError(req, res, 404, 'NOT_FOUND', err.message);
    return;
  }

  if (err instanceof StalePaymentError) {
    sendError(req, res, 409, 'CONFLICT', err.message);
    return;
  }

  if (err instanceof PersistenceError) {
    req.log?.error({ err, requestId: req.requestId }, 'Payment persistence failure');
    sendError(
      req,
      res,
      503,
      'SERVICE_UNAVAILABLE',
      'Payment store is temporarily unavailable',
    );
    return;
  }

  if (isPayloadTooLarge(err)) {
    sendError(
      req,
      res,
      413,
      'PAYLOAD_TOO_LARGE',
      'Request body exceeds the 16kb limit',
    );
    return;
  }

  const isSyntaxError = err instanceof SyntaxError && 'body' in err;
  if (isSyntaxError) {
    sendError(req, res, 400, 'INVALID_JSON', 'Request body must be valid JSON');
    return;
  }

  req.log?.error({ err, requestId: req.requestId }, 'Unhandled application error');
  sendError(req, res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
};
