import { isErrorWithStatusAndMessage } from '#core/eventStore/errors';
import { Request, Response, NextFunction } from 'express';

export function handleErrors(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  return res.status(mapStatus(err)).json({
    status: 'error',
    message: isErrorWithStatusAndMessage(err) ? err.message : undefined,
  });
}

function mapStatus(error: unknown): number {
  if (error === 'TIMEOUT_ERROR') return 504;

  return isErrorWithStatusAndMessage(error) ? error.status : 500;
}
