import type { Request, Response, NextFunction } from 'express';

export function handleErrors(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  return res.status(hasStatus(err) ? err.status : 500).json({
    status: 'error',
    message: hasMessage(err) ? err.message : undefined,
  });
}

const hasStatus = (error: unknown): error is { status: number } =>
  typeof error === 'object' &&
  error !== null &&
  'status' in error &&
  typeof error.status === 'number';

const hasMessage = (error: unknown): error is { message: string } =>
  typeof error === 'object' &&
  error !== null &&
  'message' in error &&
  typeof error.message === 'string';
