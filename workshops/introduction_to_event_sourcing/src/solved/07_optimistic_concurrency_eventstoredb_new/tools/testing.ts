import { Response, Test } from 'supertest';
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

export const runTwice = (test: () => Test) => {
  const expect = async (assert: {
    first: (test: Test) => Test;
    second: (test: Test) => Test;
  }): Promise<Test> => {
    const { first: firstExpect, second: secondExpect } = assert;

    const result = await firstExpect(test());
    await secondExpect(test());

    return result;
  };

  return { expect };
};

export const statuses = (first: number, second: number) => {
  return {
    first: (test: Test) => test.expect(first),
    second: (test: Test) => test.expect(second),
  };
};
