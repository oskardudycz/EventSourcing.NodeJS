//////////////////////////////////////
/// ESDB
//////////////////////////////////////

import { EventStoreDBClient } from '@eventstore/db-client';
import { Decider } from './decider';
import { Event } from './event';
import { ETag } from './http';
import { AppendResult, appendToStream, readStream } from './streams';

export const CommandHandler =
  <State, Command, EventType extends Event>(
    eventStore: EventStoreDBClient,
    decider: Decider<State, Command, EventType>
  ) =>
  async (
    streamId: string,
    command: Command,
    eTag: ETag
  ): Promise<AppendResult> => {
    const events = await readStream<EventType>(eventStore, streamId);

    const state = events.reduce<State>(
      decider.evolve,
      decider.getInitialState()
    );

    const newEvents = decider.decide(command, state);

    return appendToStream(eventStore, streamId, eTag, ...newEvents);
  };
