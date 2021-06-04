import { EventStoreDBClient } from '@eventstore/db-client';
import { SnapshotEvent } from '..';
import { Result } from '../../../primitives/result';
import {
  appendToStream,
  AppendResult,
  FAILED_TO_APPEND_EVENT,
} from '../../eventStoreDB/appending/appendToStream';

export async function appendSnapshotToTheSameStream<
  SnapshotStreamEvent extends SnapshotEvent
>(
  eventStore: EventStoreDBClient,
  snapshot: SnapshotStreamEvent,
  streamName: string
): Promise<Result<AppendResult, FAILED_TO_APPEND_EVENT>> {
  const result = await appendToStream(eventStore, streamName, snapshot);

  if (result.isError) return result;

  const { nextExpectedRevision: lastSnapshotVersion } = result.value;

  await eventStore.setStreamMetadata(streamName, {
    lastSnapshotVersion,
  });

  return result;
}
