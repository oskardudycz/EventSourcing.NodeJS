import { EventStoreDBClient } from '@eventstore/db-client';
import { Event } from '../../../events';
import { Result } from '../../../primitives/result';
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
): Promise<Result<boolean, Error>> {
  return addGeneric<Command, StreamEvent, Error>(
    (...args) => store(eventStore, ...args),
    streamName,
    command,
    handle
  );
}
