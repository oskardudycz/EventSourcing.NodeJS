import { EventStoreDBClient } from '@eventstore/db-client';
import { SnapshotEvent } from '..';
import { appendToStream } from '../../eventStoreDB/appending/appendToStream';
import { addSnapshotPrefix } from '..';

export async function appendSnapshotToStreamWithPrefix<
  SnapshotStreamEvent extends SnapshotEvent
>(
  eventStore: EventStoreDBClient,
  snapshot: SnapshotStreamEvent,
  streamName: string,
  lastSnapshotVersion: bigint | undefined
): Promise<boolean> {
  const snapshotStreamName = addSnapshotPrefix(streamName);

  if (!lastSnapshotVersion) {
    eventStore.setStreamMetadata(snapshotStreamName, { maxCount: 1 });
  }

  const result = await appendToStream(eventStore, snapshotStreamName, snapshot);

  return result.success;
}
