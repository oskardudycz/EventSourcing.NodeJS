import { EventStoreDBClient } from '@eventstore/db-client';
import { SnapshotEvent } from '..';
import { readLastEventFromStream } from '../../reading';
import { addSnapshotPrefix } from '..';
import { failure, Result } from '../../../primitives/result';

export type NO_SHAPSHOT_FOUND = 'NO_SHAPSHOT_FOUND';

export async function readSnapshotFromSeparateStream<
  SnapshotStreamEvent extends SnapshotEvent
>(
  eventStore: EventStoreDBClient,
  streamName: string,
  buildSnapshotStreamName?: (streamName: string) => string
): Promise<Result<SnapshotStreamEvent, NO_SHAPSHOT_FOUND>> {
  const getSnapshotStreamName = buildSnapshotStreamName || addSnapshotPrefix;
  const snapshotStreamName = getSnapshotStreamName(streamName);

  const result = await readLastEventFromStream<SnapshotStreamEvent>(
    eventStore,
    snapshotStreamName
  );

  if (result.isError) {
    return failure('NO_SHAPSHOT_FOUND');
  }

  return result;
}
