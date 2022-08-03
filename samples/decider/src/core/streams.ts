//////////////////////////////////////
/// Getting the state from events
//////////////////////////////////////

import {
  EventStoreDBClient,
  EventType,
  jsonEvent,
  NO_STREAM,
  RecordedEvent,
  ResolvedEvent,
  StreamingRead,
  WrongExpectedVersionError,
} from '@eventstore/db-client';
import { Event } from './event';
import { ETag, toWeakETag } from './http';

export type ApplyEvent<Entity, E extends EventType> = (
  currentState: Entity | undefined,
  event: RecordedEvent<E>
) => Entity;

export const StreamAggregator =
  <Entity, StreamEvents extends EventType>(
    when: ApplyEvent<Entity, StreamEvents>
  ) =>
  async (
    eventStream: StreamingRead<ResolvedEvent<StreamEvents>>
  ): Promise<Entity> => {
    let currentState: Entity | undefined = undefined;
    for await (const { event } of eventStream) {
      if (!event) continue;
      currentState = when(currentState, event);
    }
    if (currentState == null) throw 'oh no';
    return currentState;
  };

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
        expectedRevision: eTag ? BigInt(eTag) : NO_STREAM,
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
