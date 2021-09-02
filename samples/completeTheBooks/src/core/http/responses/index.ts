import { Response } from 'express';
export function sendCreated(response: Response, createdId: string): void {
  response.setHeader('Location', `/cash-registers/${createdId}`);
  response.status(201).json({ id: createdId });
}
