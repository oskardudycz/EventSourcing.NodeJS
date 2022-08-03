//////////////////////////////////////
/// Getting the state from events
//////////////////////////////////////

import {
  EventStoreDBClient,
  jsonEvent,
  NO_STREAM,
  WrongExpectedVersionError,
} from '@eventstore/db-client';
import { Event } from './decider';
import { ETag, getExpectedRevisionFromETag, toWeakETag } from './eTag';

//////////////////////////////////////
/// ESDB
//////////////////////////////////////

let eventStore: EventStoreDBClient;

export const getEventStore = (connectionString?: string) => {
  if (!eventStore) {
    eventStore = EventStoreDBClient.connectionString(
      connectionString ?? 'esdb://localhost:2113?tls=false'
    );
  }

  return eventStore;
};

export const readStream = async <EventType extends Event>(
  eventStore: EventStoreDBClient,
  streamId: string
) => {
  const events = [];
  for await (const { event } of eventStore.readStream<EventType>(streamId)) {
    if (!event) continue;

    events.push(<EventType>{
      type: event.type,
      data: event.data,
    });
  }
  return events;
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
      }
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
