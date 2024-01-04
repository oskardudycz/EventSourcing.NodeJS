import { EventStoreDBClient } from '@eventstore/db-client';
import { SnapshotEvent } from '..';
import { readLastEventFromStream } from '../../reading';
import { addSnapshotPrefix } from '..';
import { failure, Result } from '../../../primitives';
import { StreamEvent } from '#core/events';

export type NO_SHAPSHOT_FOUND = 'NO_SHAPSHOT_FOUND';

export async function readSnapshotFromSeparateStream<
  SnapshotStreamEvent extends SnapshotEvent,
>(
  eventStore: EventStoreDBClient,
  streamName: string,
  buildSnapshotStreamName?: (streamName: string) => string,
): Promise<Result<StreamEvent<SnapshotStreamEvent>, NO_SHAPSHOT_FOUND>> {
  const getSnapshotStreamName = buildSnapshotStreamName || addSnapshotPrefix;
  const snapshotStreamName = getSnapshotStreamName(streamName);

  const result = await readLastEventFromStream<SnapshotStreamEvent>(
    eventStore,
    snapshotStreamName,
  );

  if (result.isError) {
    return failure('NO_SHAPSHOT_FOUND');
  }

  return result;
}
