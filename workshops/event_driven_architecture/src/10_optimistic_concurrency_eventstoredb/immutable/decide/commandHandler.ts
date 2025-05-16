import { type Command } from '../../tools/commands';
import { type Event } from '../../tools/events';
import { type EventStore } from '../../tools/eventStore';
import { type Decider } from './decider';

export const CommandHandler =
  <State, CommandType extends Command, StreamEvent extends Event>(
    {
      decide,
      evolve,
      getInitialState,
    }: Decider<State, CommandType, StreamEvent>,
    mapToStreamId: (id: string) => string,
  ) =>
  async (eventStore: EventStore, id: string, command: CommandType) => {
    const streamName = mapToStreamId(id);

    const state = await eventStore.aggregateStream(streamName, {
      evolve,
      getInitialState,
    });

    const result = decide(command, state ?? getInitialState());

    return eventStore.appendToStream(
      streamName,
      Array.isArray(result) ? result : [result],
    );
  };
