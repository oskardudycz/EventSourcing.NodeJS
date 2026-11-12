//////////////////////////////////////
/// KurrentDB
//////////////////////////////////////

import type { KurrentDBClient } from '@kurrent/kurrentdb-client';
import type { Command, Decider, Event } from './decider';
import type { ETag } from './eTag';
import type { AppendResult } from './streams';
import { appendToStream, readStream } from './streams';

export const CommandHandler =
  <State, CommandType extends Command, EventType extends Event>(
    getEventStore: () => KurrentDBClient,
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
