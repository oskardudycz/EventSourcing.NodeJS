import type { ReadFromStreamAndSnapshotsResult } from '../snapshotting/reading/';
import type { Event, StreamEvent } from '../../events';
import type { STREAM_NOT_FOUND } from '../reading';
import type { KurrentDBClient } from '@kurrent/kurrentdb-client';
import type { Result } from '../../primitives';
import type { AppendResult, FAILED_TO_APPEND_EVENT } from '.';

export async function getAndUpdate<
  Command,
  StreamEventType extends Event,
  HANDLE_ERROR = never,
  STORE_ERROR = never,
>(
  getEvents: (
    eventStore: KurrentDBClient,
    streamName: string,
  ) => Promise<
    Result<ReadFromStreamAndSnapshotsResult<StreamEventType>, STREAM_NOT_FOUND>
  >,
  handle: (
    currentEvents: StreamEvent<StreamEventType>[],
    command: Command,
  ) => Result<StreamEventType, HANDLE_ERROR>,
  store: (
    eventStore: KurrentDBClient,
    streamName: string,
    currentEvents: StreamEvent<StreamEventType>[],
    newEvent: StreamEventType,
    lastSnapshotVersion?: bigint,
  ) => Promise<Result<AppendResult, FAILED_TO_APPEND_EVENT | STORE_ERROR>>,
  eventStore: KurrentDBClient,
  streamName: string,
  command: Command,
): Promise<
  Result<
    AppendResult,
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
