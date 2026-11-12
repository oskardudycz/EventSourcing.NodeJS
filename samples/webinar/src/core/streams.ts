//////////////////////////////////////
/// Getting the state from events
//////////////////////////////////////

import type {
  EventType,
  RecordedEvent,
  ResolvedEvent,
} from '@kurrent/kurrentdb-client';
import { KurrentDBClient } from '@kurrent/kurrentdb-client';

export type ApplyEvent<Entity, E extends EventType> = (
  currentState: Entity | undefined,
  event: RecordedEvent<E>,
) => Entity;

export const StreamAggregator =
  <Entity, StreamEvents extends EventType>(
    when: ApplyEvent<Entity, StreamEvents>,
  ) =>
  async (
    eventStream: AsyncIterableIterator<ResolvedEvent<StreamEvents>>,
  ): Promise<Entity> => {
    let currentState: Entity | undefined = undefined;
    for await (const { event } of eventStream) {
      if (!event) continue;
      currentState = when(currentState, event);
    }
    if (currentState == null) throw new Error('oh no');
    return currentState;
  };

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
