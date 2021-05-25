import { ReadFromStreamAndSnapshotsResult } from '../../snapshotting/reading/';
import { Event } from '../../../events';
import { STREAM_NOT_FOUND } from '../../reading';
import { EventStoreDBClient } from '@eventstore/db-client';
import { getAndUpdate as genericGetAndUpdate } from '../../appending';

export async function getAndUpdate<
  Command,
  StreamEvent extends Event,
  Error = never
>(
  eventStore: EventStoreDBClient,
  getEvents: (
    eventStore: EventStoreDBClient,
    streamName: string
  ) => Promise<
    ReadFromStreamAndSnapshotsResult<StreamEvent> | STREAM_NOT_FOUND
  >,
  store: (
    eventStore: EventStoreDBClient,
    streamName: string,
    newEvent: StreamEvent,
    currentEvents: StreamEvent[],
    lastSnapshotVersion?: bigint | undefined
  ) => Promise<boolean>,
  streamName: string,
  command: Command,
  handle: (
    currentEvents: StreamEvent[],
    command: Command
  ) => StreamEvent | Error
): Promise<boolean | STREAM_NOT_FOUND | Error | never> {
  return genericGetAndUpdate<Command, StreamEvent, Error>(
    (...args) => getEvents(eventStore, ...args),
    (...args) => store(eventStore, ...args),
    streamName,
    command,
    handle
  );
}
