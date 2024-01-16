import { Event } from '../../tools/events';
import { EventStore } from '../../tools/eventStore';

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
  ) => {
    const streamName = mapToStreamId(id);

    const state = await eventStore.aggregateStream(streamName, {
      evolve,
      getInitialState,
    });

    const result = handle(state ?? getInitialState());

    return eventStore.appendToStream(
      streamName,
      Array.isArray(result) ? result : [result],
    );
  };
