import { isErrorWithType } from '#core/eventStore/errors';
import type { KurrentDBClient } from '@kurrent/kurrentdb-client';
import { ErrorType } from '@kurrent/kurrentdb-client';
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
    if (!isErrorWithType(error)) {
      expect(true).toBeFalsy();
      return;
    }
    expect(error.type).toBe(ErrorType.STREAM_NOT_FOUND);
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
