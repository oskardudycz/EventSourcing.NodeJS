import {
  NO_SHAPSHOT_FOUND,
  ReadFromStreamAndSnapshotsResult,
  SnapshotEvent,
} from '..';
import { Event } from '../../../events';
import { failure, Result, success } from '../../../primitives/result';
import { STREAM_NOT_FOUND } from '../../reading';

export async function readFromSnapshotAndStream<
  StreamEvent extends Event,
  SnapshotStreamEvent extends SnapshotEvent
>(
  getLastSnapshot: (
    streamName: string
  ) => Promise<SnapshotStreamEvent | NO_SHAPSHOT_FOUND>,
  readFromStream: (
    streamName: string,
    fromVersion?: bigint | undefined
  ) => Promise<StreamEvent[] | STREAM_NOT_FOUND>,
  streamName: string
): Promise<
  Result<
    ReadFromStreamAndSnapshotsResult<StreamEvent | SnapshotStreamEvent>,
    STREAM_NOT_FOUND
  >
> {
  const snapshot = await getLastSnapshot(streamName);

  let lastSnapshotVersion: bigint | undefined = undefined;
  let snapshotEvent: SnapshotStreamEvent | undefined = undefined;

  if (snapshot !== 'NO_SHAPSHOT_FOUND') {
    lastSnapshotVersion = BigInt(snapshot.metadata.streamVersion);
    snapshotEvent = snapshot;
  }

  const events = await readFromStream(
    streamName,
    lastSnapshotVersion !== undefined ? lastSnapshotVersion + 1n : undefined
  );

  if (events === 'STREAM_NOT_FOUND') {
    return failure('STREAM_NOT_FOUND');
  }

  return success({
    events: snapshotEvent ? [snapshotEvent, ...events] : events,
    lastSnapshotVersion,
  });
}
