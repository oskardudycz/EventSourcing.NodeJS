import type { KurrentDBClient } from '@kurrent/kurrentdb-client';
import type { SnapshotEvent } from '..';
import { readLastEventFromStream } from '../../reading';
import { addSnapshotPrefix } from '..';
import type { Result } from '../../../primitives';
import { failure } from '../../../primitives';
import type { StreamEvent } from '#core/events';

export type NO_SHAPSHOT_FOUND = 'NO_SHAPSHOT_FOUND';

export async function readSnapshotFromSeparateStream<
  SnapshotStreamEvent extends SnapshotEvent,
>(
  eventStore: KurrentDBClient,
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
