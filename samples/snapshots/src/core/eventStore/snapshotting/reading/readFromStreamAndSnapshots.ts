import { EventStoreDBClient } from '@eventstore/db-client';
import { ReadStreamOptions } from '@eventstore/db-client/dist/streams';
import { NO_SHAPSHOT_FOUND, SnapshotEvent } from '../';

import { Event } from '../../../events';
import { readFromStream, STREAM_NOT_FOUND } from '../../reading';

export type ReadFromStreamAndSnapshotsResult<
  StreamEvent extends Event = Event
> = {
  events: StreamEvent[];
  lastSnapshotVersion?: bigint;
};

export async function readFromStreamAndSnapshot<
  StreamEvent extends Event,
  SnapshotStreamEvent extends SnapshotEvent
>(
  eventStore: EventStoreDBClient,
  streamName: string,
  getLastSnapshot: (
    streamName: string
  ) => Promise<SnapshotStreamEvent | NO_SHAPSHOT_FOUND>,
  options?: ReadStreamOptions
): Promise<
  | ReadFromStreamAndSnapshotsResult<StreamEvent | SnapshotStreamEvent>
  | STREAM_NOT_FOUND
> {
  const snapshot = await getLastSnapshot(streamName);

  let lastSnapshotVersion: bigint | undefined = undefined;
  let snapshotEvent: SnapshotStreamEvent[] = [];

  if (snapshot !== 'NO_SHAPSHOT_FOUND') {
    lastSnapshotVersion = snapshot.metadata.streamVersion;
    snapshotEvent = [snapshot];
  }

  const events = await readFromStream<StreamEvent>(eventStore, streamName, {
    ...options,
    fromRevision: lastSnapshotVersion,
  });

  if (events === 'STREAM_NOT_FOUND') {
    return 'STREAM_NOT_FOUND';
  }

  return { events: [...snapshotEvent, ...events], lastSnapshotVersion };
}
