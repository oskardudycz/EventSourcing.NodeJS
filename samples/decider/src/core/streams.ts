//////////////////////////////////////
/// Getting the state from events
//////////////////////////////////////

import {
  EventStoreDBClient,
  jsonEvent,
  NO_STREAM,
  StreamNotFoundError,
  WrongExpectedVersionError,
} from '@eventstore/db-client';
import { Event } from './decider';
import { ETag, getWeakETagValue, toWeakETag } from './eTag';
import { assertBigInt } from './validation';

//////////////////////////////////////
/// ESDB
//////////////////////////////////////

let eventStore: EventStoreDBClient;

export const getEventStore = (connectionString?: string) => {
  if (!eventStore) {
    eventStore = EventStoreDBClient.connectionString(
      connectionString ?? 'esdb://localhost:2113?tls=false',
    );
  }

  return eventStore;
};

export const readStream = async <EventType extends Event>(
  eventStore: EventStoreDBClient,
  streamId: string,
): Promise<EventType[]> => {
  const events = [];
  try {
    for await (const { event } of eventStore.readStream<EventType>(streamId)) {
      if (!event) continue;

      events.push(<EventType>{
        type: event.type,
        data: event.data,
      });
    }
    return events;
  } catch (error) {
    if (error instanceof StreamNotFoundError) {
      return [];
    }

    throw error;
  }
};

export type AppendResult =
  | {
      nextExpectedRevision: ETag;
      successful: true;
    }
  | { expected: ETag; actual: ETag; successful: false };

export const appendToStream = async (
  eventStore: EventStoreDBClient,
  streamId: string,
  eTag: ETag | undefined,
  ...events: Event[]
): Promise<AppendResult> => {
  try {
    const result = await eventStore.appendToStream(
      streamId,
      events.map(jsonEvent),
      {
        expectedRevision: eTag ? getExpectedRevisionFromETag(eTag) : NO_STREAM,
      },
    );

    return {
      successful: true,
      nextExpectedRevision: toWeakETag(result.nextExpectedRevision),
    };
  } catch (error) {
    if (error instanceof WrongExpectedVersionError) {
      return {
        successful: false,
        expected: toWeakETag(error.expectedVersion),
        actual: toWeakETag(error.actualVersion),
      };
    }
    throw error;
  }
};

export const getExpectedRevisionFromETag = (
  eTag: ETag,
): bigint | 'no_stream' => {
  const revision = assertBigInt(getWeakETagValue(eTag));

  if (revision === -1n) return NO_STREAM;

  return revision;
};

export const disconnectFromEventStore = async () => {
  const eventStore = getEventStore();

  try {
    return await eventStore.dispose();
  } catch (ex) {
    console.error(ex);
  }
};
