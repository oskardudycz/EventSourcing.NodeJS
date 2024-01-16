import { Command } from '../../tools/commands';
import { EventStore } from '../../tools/eventStore';
import { Event } from '../../tools/events';
import { Decider } from './decider';

export const CommandHandler =
  <State, CommandType extends Command, StreamEvent extends Event>(
    {
      decide,
      evolve,
      getInitialState,
    }: Decider<State, CommandType, StreamEvent>,
    mapToStreamId: (id: string) => string,
  ) =>
  async (
    eventStore: EventStore,
    id: string,
    command: CommandType,
    options?: { expectedRevision?: bigint },
  ) => {
    const streamName = mapToStreamId(id);

    const state = await eventStore.aggregateStream(streamName, {
      evolve,
      getInitialState,
      expectedRevision: options?.expectedRevision,
    });

    const result = decide(command, state ?? getInitialState());

    return eventStore.appendToStream(
      streamName,
      Array.isArray(result) ? result : [result],
      options,
    );
  };
