import { EventStoreDBClient } from '@eventstore/db-client';
import { Event } from '../../../events';
import { SnapshotEvent } from '..';
import { appendToStream } from '../../appending/appendToStream';

export type SnapshotOptions<
  Aggregate extends Record<string, unknown> = Record<string, unknown>,
  StreamEvent extends Event = Event,
  SnapshotStreamEvent extends SnapshotEvent = SnapshotEvent
> = {
  appendSnapshot: (
    snapshot: SnapshotStreamEvent,
    streamName: string
  ) => Promise<boolean>;
  shouldDoSnapshot: (
    event: StreamEvent,
    lastSnapshotVersion: bigint | undefined,
    currentStreamVersion: bigint,
    streamName: string,
    currentState: Aggregate
  ) => boolean;
  buildSnapshot: (
    currentState: Aggregate,
    currentStreamVersion: bigint,
    streamName: string,
    event: StreamEvent
  ) => SnapshotStreamEvent;
};

export async function appendEventAndSnapshot<
  Aggregate extends Record<string, unknown> = Record<string, unknown>,
  StreamEvent extends Event = Event,
  SnapshotStreamEvent extends SnapshotEvent = SnapshotEvent
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
    position: currentStreamPosition,
  } = await appendToStream(client, streamName, event);

  if (!eventWasAdded || !currentStreamPosition) {
    return false;
  }

  const { shouldDoSnapshot, buildSnapshot, appendSnapshot } = options;

  if (
    !shouldDoSnapshot(
      event,
      lastSnapshotVersion,
      currentStreamPosition.commit,
      streamName,
      currentState
    )
  ) {
    return true;
  }

  const snapshot = buildSnapshot(
    currentState,
    currentStreamPosition.commit,
    streamName,
    event
  );

  return appendSnapshot(snapshot, streamName);
}
