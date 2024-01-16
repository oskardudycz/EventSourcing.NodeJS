import { Response } from 'supertest';
import { getWeakETagValue } from './etag';
import { assertUnsignedBigInt } from './validation';

export type TestResponse<RequestBody> = Omit<
  Omit<Response, 'body'>,
  'headers'
> & {
  body: Partial<RequestBody>;
  headers: Record<string, string>;
};

export const expectNextRevisionInResponseEtag = <RequestBody>(
  response: TestResponse<RequestBody>,
) => {
  const eTagValue = response.headers['etag'];
  expect(eTagValue).toBeDefined();
  expect(eTagValue).toMatch(/W\/"\d+.*"/);

  const eTag = getWeakETagValue(eTagValue);

  return assertUnsignedBigInt(eTag);
};
