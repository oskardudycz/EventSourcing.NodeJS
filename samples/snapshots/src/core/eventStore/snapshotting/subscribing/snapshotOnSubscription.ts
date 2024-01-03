import { EventStoreDBClient } from '@eventstore/db-client';
import { ReadFromStreamAndSnapshotsResult } from '../../snapshotting/reading/';
import { Event } from '../../../events';
import { ReadFromStreamOptions, STREAM_NOT_FOUND } from '../../reading';
import { Result, success } from '../../../primitives';
import { AppendResult } from '../../appending';
import {
  FAILED_TO_APPEND_SNAPSHOT,
  SnapshotEvent,
  SNAPSHOT_CREATION_SKIPPED,
} from '..';

export async function snapshotOnSubscription<
  StreamEvent extends Event,
  SnapshotStreamEvent extends SnapshotEvent = StreamEvent & SnapshotEvent,
>(
  getEvents: (
    eventStore: EventStoreDBClient,
    streamName: string,
    readEventsOptions?: ReadFromStreamOptions,
  ) => Promise<
    Result<
      ReadFromStreamAndSnapshotsResult<StreamEvent | SnapshotStreamEvent>,
      STREAM_NOT_FOUND
    >
  >,
  appendSnapshot: (
    snapshot: SnapshotStreamEvent,
    streamName: string,
    lastSnapshotVersion: bigint | undefined,
  ) => Promise<Result<AppendResult, FAILED_TO_APPEND_SNAPSHOT>>,
  shouldDoSnapshot: (options: {
    newEvent: StreamEvent;
    currentStreamVersion: bigint;
    streamName: string;
  }) => boolean,
  buildSnapshot: (options: {
    newEvent: StreamEvent;
    currentEvents: (StreamEvent | SnapshotStreamEvent)[];
    currentStreamVersion: bigint;
    lastSnapshotVersion: bigint | undefined;
    streamName: string;
  }) => Result<SnapshotStreamEvent, SNAPSHOT_CREATION_SKIPPED>,
  eventStore: EventStoreDBClient,
  newEvent: StreamEvent,
  {
    position,
    revision,
    streamName,
  }: { position: bigint; revision: bigint; streamName: string },
): Promise<Result<boolean, STREAM_NOT_FOUND | FAILED_TO_APPEND_SNAPSHOT>> {
  if (
    !shouldDoSnapshot({ newEvent, currentStreamVersion: revision, streamName })
  )
    return success(false);

  const events = await getEvents(eventStore, streamName, {
    toPosition: position,
  });

  if (events.isError === true) return events;

  const { events: currentEvents, lastSnapshotVersion } = events.value;

  const snapshot = buildSnapshot({
    currentStreamVersion: revision,
    currentEvents,
    newEvent,
    streamName,
    lastSnapshotVersion,
  });

  if (snapshot.isError === true) return success(false);

  const result = await appendSnapshot(
    snapshot.value,
    streamName,
    lastSnapshotVersion,
  );

  if (result.isError) return success(false);

  return success(true);
}
