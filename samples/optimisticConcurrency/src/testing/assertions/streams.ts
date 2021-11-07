import { ErrorType, EventStoreDBClient } from '@eventstore/db-client';
import { asyncSize, asyncIsEmpty } from 'iter-tools-es';

export async function expectStreamToNotExist(
  eventStore: EventStoreDBClient,
  streamName: string
) {
  try {
    const isEmpty = await asyncIsEmpty(eventStore.readStream(streamName));

    expect(isEmpty).toBeFalsy();
  } catch (error: any) {
    expect(error?.type).toBe(ErrorType.STREAM_NOT_FOUND);
  }
}

export async function expectStreamToHaveNumberOfEvents(
  eventStore: EventStoreDBClient,
  streamName: string,
  expectedNumberOfEvents: number
) {
  try {
    const events = eventStore.readStream(streamName);

    const numberOfEvents = await asyncSize(events);

    expect(numberOfEvents).toBe(expectedNumberOfEvents);
  } catch (error) {
    expect(error).toBeUndefined();
  }
}
