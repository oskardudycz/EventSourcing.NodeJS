import { EventStoreDBClient } from '@eventstore/db-client';
import { addSnapshotPrefix, SnapshotEvent } from '.';
import { appendToStream } from '../appending/appendToStream';

export async function appendSnapshotToStreamWithPrefix<
  SnapshotStreamEvent extends SnapshotEvent
>(
  eventStore: EventStoreDBClient,
  snapshot: SnapshotStreamEvent,
  streamName: string
): Promise<boolean> {
  const snapshotStreamName = addSnapshotPrefix(streamName);

  const result = await appendToStream(eventStore, snapshotStreamName, snapshot);

  return result.success;
}
