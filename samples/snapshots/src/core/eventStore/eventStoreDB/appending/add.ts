import { EventStoreDBClient } from '@eventstore/db-client';
import { Event } from '../../../events';
import { STREAM_NOT_FOUND } from '../../reading';
import { add as addGeneric } from '../../appending';

export async function add<Command, StreamEvent extends Event, Error = never>(
  eventStore: EventStoreDBClient,
  store: (
    eventStore: EventStoreDBClient,
    streamName: string,
    newEvent: StreamEvent
  ) => Promise<boolean>,
  streamName: string,
  command: Command,
  handle: (command: Command) => StreamEvent | Error
): Promise<boolean | STREAM_NOT_FOUND | Error | never> {
  return addGeneric<Command, StreamEvent, Error>(
    (...args) => store(eventStore, ...args),
    streamName,
    command,
    handle
  );
}
