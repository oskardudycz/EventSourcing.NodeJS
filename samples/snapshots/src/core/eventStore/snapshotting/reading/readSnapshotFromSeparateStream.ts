import { EventStoreDBClient } from '@eventstore/db-client';
import { SnapshotEvent } from '..';
import { readLastEventFromStream } from '../../reading';
import { addSnapshotPrefix } from '..';

export type NO_SHAPSHOT_FOUND = 'NO_SHAPSHOT_FOUND';

export async function readSnapshotFromSeparateStream<
  SnapshotStreamEvent extends SnapshotEvent
>(
  eventStore: EventStoreDBClient,
  streamName: string,
  buildSnapshotStreamName?: (streamName: string) => string
): Promise<SnapshotStreamEvent | NO_SHAPSHOT_FOUND> {
  const getSnapshotStreamName = buildSnapshotStreamName || addSnapshotPrefix;
  const snapshotStreamName = getSnapshotStreamName(streamName);

  const result = await readLastEventFromStream<SnapshotStreamEvent>(
    eventStore,
    snapshotStreamName
  );

  if (result === 'STREAM_NOT_FOUND' || result === 'NO_EVENTS_FOUND') {
    return 'NO_SHAPSHOT_FOUND';
  }

  return result;
}
