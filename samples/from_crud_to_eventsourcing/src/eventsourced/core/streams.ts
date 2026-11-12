//////////////////////////////////////
/// Getting the state from events
//////////////////////////////////////

import { config } from '#config';
import type {
  EventType,
  RecordedEvent,
  ResolvedEvent,
} from '@kurrent/kurrentdb-client';
import { KurrentDBClient } from '@kurrent/kurrentdb-client';

export const StreamAggregator =
  <Entity, StreamEvents extends EventType>(
    when: (currentState: Entity, event: RecordedEvent<StreamEvents>) => Entity,
  ) =>
  async (
    eventStream: AsyncIterableIterator<ResolvedEvent<StreamEvents>>,
  ): Promise<Entity> => {
    let currentState = {} as Entity;
    for await (const { event } of eventStream) {
      if (!event) continue;
      currentState = when(currentState, event);
    }
    return currentState;
  };

//////////////////////////////////////
/// KurrentDB
//////////////////////////////////////

let eventStore: KurrentDBClient;

export function getEventStore(): KurrentDBClient {
  if (!config.kurrentDB.connectionString) {
    throw new Error(
      'KurrentDB connection string not set. Please define "KURRENTDB_CONNECTION_STRING" environment variable',
    );
  }

  if (!eventStore) {
    eventStore = KurrentDBClient.connectionString(
      config.kurrentDB.connectionString,
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
