import { EventStoreDBClient } from '@eventstore/db-client';
import { Event } from '../../../events';
import {
  FAILED_TO_APPEND_SNAPSHOT,
  ignoreSnapshotSkipped,
  SnapshotEvent,
  SNAPSHOT_CREATION_SKIPPED,
} from '..';
import {
  AppendResult,
  appendToStream,
  FAILED_TO_APPEND_EVENT,
} from '../../eventStoreDB/appending/appendToStream';
import { Result, success } from '../../../primitives/result';
import { pipeResultAsync } from '../../../primitives/pipe';

export async function appendEventAndSeparateSnapshot<
  StreamEvent extends Event = Event,
  SnapshotStreamEvent extends SnapshotEvent = StreamEvent & SnapshotEvent
>(
  appendSnapshot: (
    snapshot: SnapshotStreamEvent,
    streamName: string,
    lastSnapshotVersion: bigint | undefined
  ) => Promise<Result<AppendResult, FAILED_TO_APPEND_SNAPSHOT>>,
  tryBuildSnapshot: (options: {
    newEvent: StreamEvent;
    currentEvents: StreamEvent[];
    currentStreamVersion: bigint;
    lastSnapshotVersion: bigint | undefined;
    streamName: string;
  }) => Result<SnapshotStreamEvent, SNAPSHOT_CREATION_SKIPPED>,
  eventStore: EventStoreDBClient,
  streamName: string,
  currentEvents: StreamEvent[],
  lastSnapshotVersion: bigint | undefined,
  event: StreamEvent
): Promise<
  Result<boolean, FAILED_TO_APPEND_EVENT | FAILED_TO_APPEND_SNAPSHOT>
> {
  return ignoreSnapshotSkipped(
    await pipeResultAsync(
      () => appendToStream(eventStore, streamName, [event]),
      async ({ nextExpectedRevision: currentStreamVersion }) =>
        tryBuildSnapshot({
          currentEvents,
          currentStreamVersion,
          lastSnapshotVersion,
          streamName,
          newEvent: event,
        }),
      async (snapshot) => {
        return appendSnapshot(snapshot, streamName, lastSnapshotVersion);
      },
      async (_) => success(true)
    )()
  );
}
