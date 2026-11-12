import type { KurrentDBClient } from '@kurrent/kurrentdb-client';
import type { FAILED_TO_APPEND_SNAPSHOT, SnapshotEvent } from '..';
import type { AppendResult } from '../../appending/appendToStream';
import { appendToStream } from '../../appending/appendToStream';
import { addSnapshotPrefix } from '..';
import type { Result } from '../../../primitives';
import { failure } from '../../../primitives';

export async function appendSnapshotToStreamWithPrefix<
  SnapshotStreamEvent extends SnapshotEvent,
>(
  eventStore: KurrentDBClient,
  snapshot: SnapshotStreamEvent,
  streamName: string,
  lastSnapshotVersion?: bigint,
): Promise<Result<AppendResult, FAILED_TO_APPEND_SNAPSHOT>> {
  const snapshotStreamName = addSnapshotPrefix(streamName);

  if (!lastSnapshotVersion) {
    await eventStore.setStreamMetadata(snapshotStreamName, { maxCount: 1 });
  }

  const result = await appendToStream(eventStore, snapshotStreamName, [
    snapshot,
  ]);

  if (result.isError) return failure('FAILED_TO_APPEND_SNAPSHOT');

  return result;
}
