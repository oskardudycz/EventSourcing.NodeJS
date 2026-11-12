import { jsonEvent } from '@kurrent/kurrentdb-client';
import { v4 as uuid } from 'uuid';
import type { StartedKurrentDBContainer } from './kurrentDBContainer';
import { KurrentDBContainer } from './kurrentDBContainer';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('KurrentDBContainer', () => {
  let container: StartedKurrentDBContainer;

  beforeAll(async () => {
    container = await new KurrentDBContainer().start();
  });

  it('should connect to KurrentDB and append new event', async () => {
    const client = container.getClient();

    const result = await client.appendToStream(
      `test-${uuid()}`,
      jsonEvent({ type: 'test-event', data: { test: 'test' } }),
    );

    expect(result.success).toBeTruthy();
  });

  afterAll(async () => {
    await container.stop();
  });
});
