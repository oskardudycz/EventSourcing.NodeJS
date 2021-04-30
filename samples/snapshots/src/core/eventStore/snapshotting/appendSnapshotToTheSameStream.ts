import { EventStoreDBClient } from '@eventstore/db-client';
import { SnapshotEvent } from '.';
import { appendToStream } from '../appending/appendToStream';

export async function appendSnapshotToTheSameStream<
  SnapshotStreamEvent extends SnapshotEvent
>(
  eventStore: EventStoreDBClient,
  snapshot: SnapshotStreamEvent,
  streamName: string
): Promise<boolean> {
  const result = await appendToStream(eventStore, streamName, snapshot);

  return result.success;
}
