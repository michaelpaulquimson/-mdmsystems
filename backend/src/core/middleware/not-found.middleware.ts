import { ErrorCode } from '@mdm/shared';
import type { Request, Response } from 'express';

export function notFoundMiddleware(_req: Request, res: Response): void {
  res.status(404).json({
    error: { code: ErrorCode.NOT_FOUND, message: 'Route not found' },
  });
}
