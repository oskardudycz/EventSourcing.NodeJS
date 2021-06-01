import { ErrorType, EventStoreDBClient } from '@eventstore/db-client';

export async function expectStreamToNotExist(
  eventStore: EventStoreDBClient,
  streamName: string
) {
  try {
    await eventStore.readStream(streamName);
  } catch (error) {
    expect(error?.type).toBe(ErrorType.STREAM_NOT_FOUND);
  }
}

export async function expectStreamToHaveNumberOfEvents(
  eventStore: EventStoreDBClient,
  streamName: string,
  expectedNumberOfEvents: number
) {
  try {
    const events = await eventStore.readStream(streamName);
    expect(events).toHaveLength(expectedNumberOfEvents);
  } catch (error) {
    expect(error).toBeUndefined();
  }
}
