//////////////////////////////////////
/// Getting the state from events
//////////////////////////////////////

import {
  KurrentDBClient,
  jsonEvent,
  NO_STREAM,
  StreamNotFoundError,
  WrongExpectedVersionError,
} from '@kurrent/kurrentdb-client';
import type { Event } from './decider';
import type { ETag } from './eTag';
import { getWeakETagValue, toWeakETag } from './eTag';
import { assertBigInt } from './validation';

//////////////////////////////////////
/// KurrentDB
//////////////////////////////////////

let eventStore: KurrentDBClient;

export const getEventStore = (connectionString?: string) => {
  if (!eventStore) {
    eventStore = KurrentDBClient.connectionString(
      connectionString ?? 'kurrentdb://localhost:2113?tls=false',
    );
  }

  return eventStore;
};

export const readStream = async <EventType extends Event>(
  eventStore: KurrentDBClient,
  streamId: string,
): Promise<EventType[]> => {
  const events: EventType[] = [];
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
  eventStore: KurrentDBClient,
  streamId: string,
  eTag: ETag | undefined,
  ...events: Event[]
): Promise<AppendResult> => {
  try {
    const result = await eventStore.appendToStream(
      streamId,
      events.map(jsonEvent),
      {
        streamState: eTag ? getExpectedRevisionFromETag(eTag) : NO_STREAM,
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
        expected: toWeakETag(error.expectedState),
        actual: toWeakETag(error.actualState),
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
