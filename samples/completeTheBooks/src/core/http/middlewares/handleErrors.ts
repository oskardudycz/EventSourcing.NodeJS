import { Request, Response, NextFunction } from 'express';

export function handleErrors(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  return res.status(err?.status ?? 500).json({
    status: 'error',
    message: err?.message,
  });
}
