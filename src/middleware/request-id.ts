import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

function incomingRequestId(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.length > 128) {
    return undefined;
  }

  return trimmed;
}

export const requestId: RequestHandler = (req, res, next) => {
  const requestIdValue =
    incomingRequestId(req.header(REQUEST_ID_HEADER)) ?? randomUUID();

  req.requestId = requestIdValue;
  res.setHeader(REQUEST_ID_HEADER, requestIdValue);
  next();
};
