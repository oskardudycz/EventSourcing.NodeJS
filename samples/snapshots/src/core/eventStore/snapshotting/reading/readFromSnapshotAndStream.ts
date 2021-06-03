import { NO_SHAPSHOT_FOUND, SnapshotEvent } from '..';
import { Event } from '../../../events';
import { STREAM_NOT_FOUND } from '../../reading';

export type ReadFromStreamAndSnapshotsResult<
  StreamEvent extends Event = Event
> = {
  events: StreamEvent[];
  lastSnapshotVersion?: bigint;
};

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
  | ReadFromStreamAndSnapshotsResult<StreamEvent | SnapshotStreamEvent>
  | STREAM_NOT_FOUND
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
    return 'STREAM_NOT_FOUND';
  }

  return {
    events: [...(snapshotEvent ? [snapshotEvent] : []), ...events],
    lastSnapshotVersion,
  };
}
