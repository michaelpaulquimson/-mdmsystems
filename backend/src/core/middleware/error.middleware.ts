import { ErrorCode } from '@mdm/shared';
import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../errors/http-errors.js';
import { logger } from '../logger/logger.js';

export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined && { details: err.details }),
      },
    });
    return;
  }

  logger.error({ err, req: { method: req.method, url: req.url } }, 'Unhandled error');

  res.status(500).json({
    error: {
      code: ErrorCode.INTERNAL,
      message: 'An unexpected error occurred',
    },
  });
}
