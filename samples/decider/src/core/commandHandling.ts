//////////////////////////////////////
/// ESDB
//////////////////////////////////////

import { EventStoreDBClient } from '@eventstore/db-client';
import { Command, Decider, Event } from './decider';
import { ETag } from './eTag';
import { AppendResult, appendToStream, readStream } from './streams';

export const CommandHandler =
  <State, CommandType extends Command, EventType extends Event>(
    getEventStore: () => EventStoreDBClient,
    toStreamId: (recordId: string) => string,
    decider: Decider<State, CommandType, EventType>,
  ) =>
  async (
    recordId: string,
    command: CommandType,
    eTag: ETag | undefined = undefined,
  ): Promise<AppendResult> => {
    const eventStore = getEventStore();

    const streamId = toStreamId(recordId);
    const events = await readStream<EventType>(eventStore, streamId);

    const state = events.reduce<State>(decider.evolve, decider.initialState());

    const newEvents = decider.decide(command, state);

    const toAppend = Array.isArray(newEvents) ? newEvents : [newEvents];

    return appendToStream(eventStore, streamId, eTag, ...toAppend);
  };
