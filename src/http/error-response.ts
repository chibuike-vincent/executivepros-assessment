import type { Request, Response } from 'express';

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
};

export function sendError(
  req: Request,
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
): void {
  if (!res.getHeader('x-request-id') && req.requestId) {
    res.setHeader('x-request-id', req.requestId);
  }

  const body: ApiErrorBody = {
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
      ...(req.requestId ? { requestId: req.requestId } : {}),
    },
  };

  res.status(statusCode).json(body);
}
