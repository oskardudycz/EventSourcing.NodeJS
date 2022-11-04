import request from 'supertest';
import { sleep } from '#core/primitives';

export async function retryTest(
  test: () => request.Test,
  retriesLeft = 5,
  delay = 1000
) {
  try {
    await test();
  } catch (error) {
    if (retriesLeft > 0) {
      await sleep(delay);

      await retryTest(test, --retriesLeft, delay);

      return;
    }
    throw error;
  }
}
