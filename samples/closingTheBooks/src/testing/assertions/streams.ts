import type { KurrentDBClient } from '@kurrent/kurrentdb-client';
import { StreamNotFoundError } from '@kurrent/kurrentdb-client';
import { asyncSize, asyncIsEmpty } from 'iter-tools-es';
import { expect } from 'vitest';

export async function expectStreamToNotExist(
  eventStore: KurrentDBClient,
  streamName: string,
) {
  try {
    const isEmpty = await asyncIsEmpty(eventStore.readStream(streamName));

    expect(isEmpty).toBeFalsy();
  } catch (error) {
    if (error instanceof StreamNotFoundError) {
      return;
    }

    expect(typeof error).toBe('StreamNotFoundError');
  }
}

export async function expectStreamToHaveNumberOfEvents(
  eventStore: KurrentDBClient,
  streamName: string,
  expectedNumberOfEvents: number,
) {
  try {
    const events = eventStore.readStream(streamName);

    const numberOfEvents = await asyncSize(events);

    expect(numberOfEvents).toBe(expectedNumberOfEvents);
  } catch (error) {
    expect(error).toBeUndefined();
  }
}
