import type { KurrentDBClient } from '@kurrent/kurrentdb-client';
import type { Event } from '../../../events';
import type {
  FAILED_TO_APPEND_SNAPSHOT,
  SnapshotEvent,
  SNAPSHOT_CREATION_SKIPPED,
} from '..';
import { ignoreSnapshotSkipped } from '..';
import type {
  AppendResult,
  FAILED_TO_APPEND_EVENT,
} from '../../appending/appendToStream';
import { appendToStream } from '../../appending/appendToStream';
import type { Result } from '../../../primitives';
import { success } from '../../../primitives';
import { pipeResultAsync } from '../../../primitives/pipe';

export async function appendEventAndExternalSnapshot<
  StreamEvent extends Event = Event,
  SnapshotStreamEvent extends SnapshotEvent = StreamEvent & SnapshotEvent,
>(
  appendSnapshot: (
    snapshot: SnapshotStreamEvent,
    streamName: string,
    lastSnapshotVersion: bigint | undefined,
  ) => Promise<Result<AppendResult, FAILED_TO_APPEND_SNAPSHOT>>,
  tryBuildSnapshot: (options: {
    newEvent: StreamEvent;
    currentEvents: StreamEvent[];
    currentStreamVersion: bigint;
    lastSnapshotVersion: bigint | undefined;
    streamName: string;
  }) => Result<SnapshotStreamEvent, SNAPSHOT_CREATION_SKIPPED>,
  eventStore: KurrentDBClient,
  streamName: string,
  currentEvents: StreamEvent[],
  lastSnapshotVersion: bigint | undefined,
  event: StreamEvent,
): Promise<
  Result<boolean, FAILED_TO_APPEND_EVENT | FAILED_TO_APPEND_SNAPSHOT>
> {
  return ignoreSnapshotSkipped(
    await pipeResultAsync(
      () => appendToStream(eventStore, streamName, [event]),
      ({ nextExpectedRevision: currentStreamVersion }) =>
        Promise.resolve(
          tryBuildSnapshot({
            currentEvents,
            currentStreamVersion,
            lastSnapshotVersion,
            streamName,
            newEvent: event,
          }),
        ),
      async (snapshot) => {
        return appendSnapshot(snapshot, streamName, lastSnapshotVersion);
      },
      () => Promise.resolve(success(true)),
    )(),
  );
}
