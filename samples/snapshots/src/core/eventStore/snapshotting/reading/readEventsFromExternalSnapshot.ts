import type { KurrentDBClient } from '@kurrent/kurrentdb-client';
import type {
  NO_SHAPSHOT_FOUND,
  ReadFromStreamAndSnapshotsResult,
  SnapshotEvent,
} from '..';
import type { Event } from '../../../events';
import type { Result } from '../../../primitives';
import { success } from '../../../primitives';
import type { ReadFromStreamOptions, STREAM_NOT_FOUND } from '../../reading';
import { readFromStream } from '../../reading';

export async function readEventsFromExternalSnapshot<
  StreamEvent extends Event,
  SnapshotStreamEvent extends SnapshotEvent = StreamEvent & SnapshotEvent,
>(
  getLastSnapshot: (
    streamName: string,
  ) => Promise<Result<SnapshotStreamEvent, NO_SHAPSHOT_FOUND>>,
  eventStore: KurrentDBClient,
  streamName: string,
  readEventsOptions?: ReadFromStreamOptions,
): Promise<
  Result<
    ReadFromStreamAndSnapshotsResult<StreamEvent | SnapshotStreamEvent>,
    STREAM_NOT_FOUND
  >
> {
  const snapshot = await getLastSnapshot(streamName);

  let snapshotEvent: SnapshotStreamEvent | undefined = undefined;
  let lastSnapshotVersion: bigint | undefined = undefined;

  if (snapshot.isError === false) {
    snapshotEvent = snapshot.value;
    lastSnapshotVersion = BigInt(
      snapshotEvent.metadata.snapshottedStreamVersion,
    );
  }

  const events = await readFromStream<StreamEvent>(eventStore, streamName, {
    fromRevision:
      lastSnapshotVersion !== undefined ? lastSnapshotVersion + 1n : undefined,
    ...readEventsOptions,
  });

  if (events.isError == true) {
    return events;
  }

  return success({
    events: snapshotEvent ? [snapshotEvent, ...events.value] : events.value,
    lastSnapshotVersion,
  });
}
