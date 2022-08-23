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

export const StreamAggregator =
  <Entity, StreamEvents extends EventType>(
    when: (currentState: Entity, event: RecordedEvent<StreamEvents>) => Entity
  ) =>
  async (
    eventStream: StreamingRead<ResolvedEvent<StreamEvents>>
  ): Promise<Entity> => {
    let currentState = {} as Entity;
    for await (const { event } of eventStream) {
      if (!event) continue;
      currentState = when(currentState, event);
    }
    return currentState;
  };

//////////////////////////////////////
/// ESDB
//////////////////////////////////////

let eventStore: EventStoreDBClient;

export function getEventStore(): EventStoreDBClient {
  if (!config.eventStoreDB.connectionString) {
    throw new Error(
      'EventStoreDB connection string not set. Please define "ESDB_CONNECTION_STRING" environment variable'
    );
  }

  if (!eventStore) {
    eventStore = EventStoreDBClient.connectionString(
      config.eventStoreDB.connectionString
    );
  }

  return eventStore;
}

export const disconnectFromEventStore = async () => {
  const eventStore = getEventStore();

  try {
    return await eventStore.dispose();
  } catch (ex) {
    console.error(ex);
  }
};
