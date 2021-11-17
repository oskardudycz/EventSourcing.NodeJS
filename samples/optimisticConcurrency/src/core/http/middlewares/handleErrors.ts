import { Request, Response, NextFunction } from 'express';

export function handleErrors(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  return res.status(mapStatus(err)).json({
    status: 'error',
    message: err?.message,
  });
}

function mapStatus(error: any): number {
  if (error === 'TIMEOUT_ERROR') return 504;

  return error?.status ?? 500;
}
