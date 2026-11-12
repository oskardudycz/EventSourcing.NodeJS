import type { KurrentDBClient } from '@kurrent/kurrentdb-client';
import { StreamNotFoundError } from '@kurrent/kurrentdb-client';
import { expect } from 'vitest';

export async function expectStreamToNotExist(
  eventStore: KurrentDBClient,
  streamName: string,
) {
  try {
    const events = eventStore.readStream(streamName, { maxCount: 1 });

    for await (const _ of events) {
      /* empty */
    }
  } catch (error) {
    if (error instanceof StreamNotFoundError) {
      return;
    }

    expect(typeof error).toBe('StreamNotFoundError');
  }

  expect(undefined).toBeDefined();
}

export async function expectStreamToHaveNumberOfEvents(
  eventStore: KurrentDBClient,
  streamName: string,
  expectedNumberOfEvents: number,
) {
  try {
    const eventStream = eventStore.readStream(streamName);

    let eventsCount = 0;

    for await (const _ of eventStream) {
      eventsCount++;
    }

    expect(eventsCount).toBe(expectedNumberOfEvents);
  } catch (error) {
    expect(error).toBeUndefined();
  }
}
