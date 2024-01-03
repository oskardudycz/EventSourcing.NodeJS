import { ReadFromStreamAndSnapshotsResult } from '../snapshotting/reading/';
import { Event } from '../../events';
import { STREAM_NOT_FOUND } from '../reading';
import { EventStoreDBClient } from '@eventstore/db-client';
import { Result } from '../../primitives';
import { FAILED_TO_APPEND_EVENT } from '.';

export async function getAndUpdate<
  Command,
  StreamEvent extends Event,
  HANDLE_ERROR = never,
  STORE_ERROR = never,
>(
  getEvents: (
    eventStore: EventStoreDBClient,
    streamName: string,
  ) => Promise<
    Result<ReadFromStreamAndSnapshotsResult<StreamEvent>, STREAM_NOT_FOUND>
  >,
  handle: (
    currentEvents: StreamEvent[],
    command: Command,
  ) => Result<StreamEvent, HANDLE_ERROR>,
  store: (
    eventStore: EventStoreDBClient,
    streamName: string,
    currentEvents: StreamEvent[],
    newEvent: StreamEvent,
    lastSnapshotVersion?: bigint | undefined,
  ) => Promise<Result<boolean, FAILED_TO_APPEND_EVENT | STORE_ERROR>>,
  eventStore: EventStoreDBClient,
  streamName: string,
  command: Command,
): Promise<
  Result<
    boolean,
    STREAM_NOT_FOUND | FAILED_TO_APPEND_EVENT | HANDLE_ERROR | STORE_ERROR
  >
> {
  const result = await getEvents(eventStore, streamName);

  if (result.isError) return result;

  const { events: currentEvents, lastSnapshotVersion } = result.value;

  const handleResult = handle(currentEvents, command);

  if (handleResult.isError) return handleResult;

  const newEvent = handleResult.value;

  return store(
    eventStore,
    streamName,
    currentEvents,
    newEvent,
    lastSnapshotVersion,
  );
}
