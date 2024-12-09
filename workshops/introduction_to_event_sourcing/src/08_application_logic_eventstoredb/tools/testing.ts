import { Response } from 'supertest';

export type TestResponse<RequestBody> = Omit<
  Omit<Response, 'body'>,
  'headers'
> & {
  body: Partial<RequestBody>;
  headers: Record<string, string>;
};
