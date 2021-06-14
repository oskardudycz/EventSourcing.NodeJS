import { ReadFromStreamAndSnapshotsResult, SnapshotEvent } from '..';
import { Event } from '../../../events';
import { Result, success } from '../../../primitives/result';
import { STREAM_NOT_FOUND } from '../../reading';

export async function readEventsFromSnapshotInTheSameStream<
  StreamEvent extends Event,
  SnapshotStreamEvent extends SnapshotEvent
>(
  getLastSnapshotVersion: (
    streamName: string
  ) => Promise<Result<bigint, STREAM_NOT_FOUND>>,
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
  const lastSnapshotVersion = await getLastSnapshotVersion(streamName);

  if (lastSnapshotVersion.isError === true) {
    return lastSnapshotVersion;
  }

  const events = await readFromStream(streamName, lastSnapshotVersion.value);

  if (events.isError === true) {
    return events;
  }

  return success({
    events: events.value,
    lastSnapshotVersion: lastSnapshotVersion.value,
  });
}
