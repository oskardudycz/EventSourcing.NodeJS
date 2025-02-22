import { type Event } from '../../tools/events';
import { type EventStore } from '../../tools/eventStore';

export const handleCommand =
  <State, StreamEvent extends Event>(
    evolve: (state: State, event: StreamEvent) => State,
    getInitialState: () => State,
    mapToStreamId: (id: string) => string,
  ) =>
  async (
    eventStore: EventStore,
    id: string,
    handle: (state: State) => StreamEvent | StreamEvent[],
    options?: { expectedRevision?: bigint },
  ) => {
    const streamName = mapToStreamId(id);

    const state = await eventStore.aggregateStream(streamName, {
      evolve,
      getInitialState,
      expectedRevision: options?.expectedRevision,
    });

    const result = handle(state ?? getInitialState());

    return eventStore.appendToStream(
      streamName,
      Array.isArray(result) ? result : [result],
      options,
    );
  };
