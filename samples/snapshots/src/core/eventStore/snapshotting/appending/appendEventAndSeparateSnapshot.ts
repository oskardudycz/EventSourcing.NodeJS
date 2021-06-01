import { EventStoreDBClient } from '@eventstore/db-client';
import { Event } from '../../../events';
import { SnapshotEvent } from '..';
import { appendToStream } from '../../eventStoreDB/appending/appendToStream';

export type SnapshotOptions<
  Aggregate extends Record<string, unknown> = Record<string, unknown>,
  StreamEvent extends Event = Event,
  SnapshotStreamEvent extends SnapshotEvent = StreamEvent & SnapshotEvent
> = {
  appendSnapshot: (
    snapshot: SnapshotStreamEvent,
    streamName: string,
    lastSnapshotVersion: bigint | undefined
  ) => Promise<boolean>;
  shouldDoSnapshot: (
    event: StreamEvent,
    currentStreamVersion: bigint,
    streamName: string,
    currentState: Aggregate
  ) => boolean;
  buildSnapshot: (
    currentState: Aggregate,
    currentStreamVersion: bigint,
    lastSnapshotVersion: bigint | undefined,
    streamName: string,
    event: StreamEvent
  ) => SnapshotStreamEvent;
};

export async function appendEventAndSeparateSnapshot<
  Aggregate extends Record<string, unknown> = Record<string, unknown>,
  StreamEvent extends Event = Event,
  SnapshotStreamEvent extends SnapshotEvent = StreamEvent & SnapshotEvent
>(
  client: EventStoreDBClient,
  streamName: string,
  currentState: Aggregate,
  lastSnapshotVersion: bigint | undefined,
  event: StreamEvent,
  options: SnapshotOptions<Aggregate, StreamEvent, SnapshotStreamEvent>
): Promise<boolean> {
  const {
    success: eventWasAdded,
    nextExpectedRevision: currentStreamVersion,
  } = await appendToStream(client, streamName, event);

  if (!eventWasAdded || !currentStreamVersion) {
    return false;
  }

  const { shouldDoSnapshot, buildSnapshot, appendSnapshot } = options;

  if (
    !shouldDoSnapshot(event, currentStreamVersion, streamName, currentState)
  ) {
    return true;
  }

  const snapshot = buildSnapshot(
    currentState,
    currentStreamVersion,
    lastSnapshotVersion,
    streamName,
    event
  );

  return appendSnapshot(snapshot, streamName, lastSnapshotVersion);
}
