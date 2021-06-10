import {
  NO_SHAPSHOT_FOUND,
  ReadFromStreamAndSnapshotsResult,
  SnapshotEvent,
} from '..';
import { Event } from '../../../events';
import { Result, success } from '../../../primitives/result';
import { STREAM_NOT_FOUND } from '../../reading';

export async function readFromSnapshotAndStream<
  StreamEvent extends Event,
  SnapshotStreamEvent extends SnapshotEvent
>(
  getLastSnapshot: (
    streamName: string
  ) => Promise<Result<SnapshotStreamEvent, NO_SHAPSHOT_FOUND>>,
  readFromStream: (
    streamName: string,
    fromVersion?: bigint | undefined
  ) => Promise<Result<StreamEvent[], STREAM_NOT_FOUND>>,
  streamName: string
): Promise<
  Result<
    ReadFromStreamAndSnapshotsResult<StreamEvent | SnapshotStreamEvent>,
    STREAM_NOT_FOUND
  >
> {
  const snapshot = await getLastSnapshot(streamName);

  let snapshotEvent: SnapshotStreamEvent | undefined = undefined;
  let lastSnapshotVersion: bigint | undefined = undefined;

  if (!snapshot.isError) {
    snapshotEvent = snapshot.value;
    lastSnapshotVersion = BigInt(snapshotEvent.metadata.streamVersion);
  }

  const events = await readFromStream(
    streamName,
    lastSnapshotVersion !== undefined ? lastSnapshotVersion + 1n : undefined
  );

  if (events.isError) {
    return events;
  }

  return success({
    events: snapshotEvent ? [snapshotEvent, ...events.value] : events.value,
    lastSnapshotVersion,
  });
}
