import type { RequestHandler } from 'express';
import { sendError } from '../http/error-response';

export const notFoundHandler: RequestHandler = (req, res) => {
  sendError(
    req,
    res,
    404,
    'NOT_FOUND',
    `Cannot ${req.method} ${req.originalUrl}`,
  );
};
