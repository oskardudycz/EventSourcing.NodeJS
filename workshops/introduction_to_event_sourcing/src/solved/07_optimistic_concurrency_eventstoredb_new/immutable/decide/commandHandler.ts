import { Event } from '../../tools/events';
import { Command } from '../../tools/commands';
import { Decider } from './decider';
import { EventStore } from '../../tools/eventStore';

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
