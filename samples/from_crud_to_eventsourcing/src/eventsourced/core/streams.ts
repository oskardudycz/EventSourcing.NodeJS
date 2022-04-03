//////////////////////////////////////
/// Getting the state from events
//////////////////////////////////////

import { config } from '#config';
import {
  EventStoreDBClient,
  EventType,
  RecordedEvent,
  ResolvedEvent,
  StreamingRead,
} from '@eventstore/db-client';

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

export function getEventStore(): EventStoreDBClient {
  if (!config.eventStoreDB.connectionString) {
    throw 'EventStoreDB connection string not set. Please define "ESDB_CONNECTION_STRING" environment variable';
  }

  if (!eventStore) {
    eventStore = EventStoreDBClient.connectionString(
      config.eventStoreDB.connectionString
    );
  }

  return eventStore;
}
