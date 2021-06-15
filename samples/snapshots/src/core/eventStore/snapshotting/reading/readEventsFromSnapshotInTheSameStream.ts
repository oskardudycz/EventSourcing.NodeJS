import { EventStoreDBClient } from '@eventstore/db-client';
import { ReadFromStreamAndSnapshotsResult, SnapshotEvent } from '..';
import { Event } from '../../../events';
import { Result, success } from '../../../primitives/result';
import { readFromStream, STREAM_NOT_FOUND } from '../../reading';

export async function readEventsFromSnapshotInTheSameStream<
  StreamEvent extends Event,
  SnapshotStreamEvent extends SnapshotEvent
>(
  getLastSnapshotVersion: (
    streamName: string
  ) => Promise<Result<bigint | undefined, STREAM_NOT_FOUND>>,
  eventStore: EventStoreDBClient,
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
