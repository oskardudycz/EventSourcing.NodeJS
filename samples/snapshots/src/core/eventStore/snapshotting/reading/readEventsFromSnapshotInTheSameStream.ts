import {
  NO_SHAPSHOT_FOUND,
  ReadFromStreamAndSnapshotsResult,
  SnapshotEvent,
} from '..';
import { Event } from '../../../events';
import { STREAM_NOT_FOUND } from '../../reading';

export async function readEventsFromSnapshotInTheSameStream<
  StreamEvent extends Event,
  SnapshotStreamEvent extends SnapshotEvent
>(
  getLastSnapshotVersion: (
    streamName: string
  ) => Promise<bigint | undefined | STREAM_NOT_FOUND>,
  readFromStream: (
    streamName: string,
    fromVersion?: bigint | undefined
  ) => Promise<StreamEvent[] | STREAM_NOT_FOUND>,
  streamName: string
): Promise<
  | ReadFromStreamAndSnapshotsResult<StreamEvent | SnapshotStreamEvent>
  | STREAM_NOT_FOUND
> {
  const lastSnapshotVersion = await getLastSnapshotVersion(streamName);

  if (lastSnapshotVersion === 'STREAM_NOT_FOUND') {
    return 'STREAM_NOT_FOUND';
  }

  const events = await readFromStream(streamName, lastSnapshotVersion);

  if (events === 'STREAM_NOT_FOUND') {
    return 'STREAM_NOT_FOUND';
  }

  return {
    events,
    lastSnapshotVersion,
  };
}
