import type { KurrentDBClient } from '@kurrent/kurrentdb-client';
import type { ReadFromStreamAndSnapshotsResult, SnapshotEvent } from '..';
import type { Event } from '../../../events';
import type { Result } from '../../../primitives';
import { success } from '../../../primitives';
import type { STREAM_NOT_FOUND } from '../../reading';
import { readFromStream } from '../../reading';
import { getLastSnapshotVersionFromStreamMetadata } from './';

export async function readEventsFromSnapshotInTheSameStream<
  StreamEvent extends Event,
  SnapshotStreamEvent extends SnapshotEvent,
>(
  eventStore: KurrentDBClient,
  streamName: string,
): Promise<
  Result<
    ReadFromStreamAndSnapshotsResult<StreamEvent | SnapshotStreamEvent>,
    STREAM_NOT_FOUND
  >
> {
  const lastSnapshotVersion = await getLastSnapshotVersionFromStreamMetadata(
    eventStore,
    streamName,
  );

  if (lastSnapshotVersion.isError === true) {
    return lastSnapshotVersion;
  }

  const events = await readFromStream<StreamEvent>(eventStore, streamName, {
    fromRevision: lastSnapshotVersion.value,
  });

  if (events.isError === true) {
    return events;
  }

  return success({
    events: events.value,
    lastSnapshotVersion: lastSnapshotVersion.value,
  });
}
