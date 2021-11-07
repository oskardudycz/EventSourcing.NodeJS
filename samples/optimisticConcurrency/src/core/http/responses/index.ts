import { Response } from 'express';
export function sendCreated(
  response: Response,
  createdId: string,
  urlPrefix?: string
): void {
  response.setHeader(
    'Location',
    `${urlPrefix ?? response.req.url}/${createdId}`
  );
  response.status(201).json({ id: createdId });
}
