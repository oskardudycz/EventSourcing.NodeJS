import { EventStoreDBClient } from '@eventstore/db-client';
import { FAILED_TO_APPEND_SNAPSHOT, SnapshotEvent } from '..';
import { AppendResult, appendToStream } from '../../appending/appendToStream';
import { addSnapshotPrefix } from '..';
import { failure, Result } from '../../../primitives';

export async function appendSnapshotToStreamWithPrefix<
  SnapshotStreamEvent extends SnapshotEvent
>(
  eventStore: EventStoreDBClient,
  snapshot: SnapshotStreamEvent,
  streamName: string,
  lastSnapshotVersion?: bigint
): Promise<Result<AppendResult, FAILED_TO_APPEND_SNAPSHOT>> {
  const snapshotStreamName = addSnapshotPrefix(streamName);

  if (!lastSnapshotVersion) {
    eventStore.setStreamMetadata(snapshotStreamName, { maxCount: 1 });
  }

  const result = await appendToStream(eventStore, snapshotStreamName, [
    snapshot,
  ]);

  if (result.isError) return failure('FAILED_TO_APPEND_SNAPSHOT');

  return result;
}
