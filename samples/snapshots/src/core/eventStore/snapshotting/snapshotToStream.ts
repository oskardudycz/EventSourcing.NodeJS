import { EventStoreDBClient, StreamSubscription } from '@eventstore/db-client';
import { Event } from '../../events';
import { SnapshotEvent } from './snapshotEvent';
import { appendToStream } from '../appending/appendToStream';
import { readFromStream } from '../reading/readFromStream';
import { subscribeToStream } from '../subscribing/subscribeToStream';

export type SnapshotOptions<
  Aggregate extends Record<string, unknown> = Record<string, unknown>,
  StreamEvent extends Event = Event,
  SnapshotStreamEvent extends SnapshotEvent = SnapshotEvent
> = {
  buildSnapshotStreamName: (streamName: string) => string;
  shouldDoSnapshot: (streamName: string, event: StreamEvent) => boolean;
  doSnapshot: (
    currentState: Aggregate,
    streamName: string,
    event: StreamEvent
  ) => SnapshotStreamEvent;
};

export async function appendEventsAndSnapshotsToTheSameStream<
  Aggregate,
  StreamEvent extends Event,
  SnapshotStreamEvent extends SnapshotEvent
>(
  client: EventStoreDBClient,
  streamName: string,
  currentState: Aggregate,
  tryDoSnapshot: (
    streamName: string,
    currentState: Aggregate,
    event: StreamEvent
  ) => SnapshotStreamEvent | undefined,
  ...events: StreamEvent[]
): Promise<boolean> {
  const eventsAndSnapshots = events
    .map((event) => {
      const snapshot = tryDoSnapshot(streamName, currentState, event);

      return snapshot ? [snapshot, event] : [event];
    })
    .flat();

  return (
    await appendToStream<StreamEvent | SnapshotStreamEvent>(
      client,
      streamName,
      ...eventsAndSnapshots
    )
  ).success;
}

export async function appendEventsAndSnapshotsToTheSeparateStreams<
  Aggregate extends Record<string, unknown> = Record<string, unknown>,
  StreamEvent extends Event = Event,
  SnapshotStreamEvent extends SnapshotEvent = SnapshotEvent
>(
  client: EventStoreDBClient,
  streamName: string,
  currentState: Aggregate,
  appendSnapshot: (
    streamName: string,
    currentState: Aggregate,
    event: StreamEvent
  ) => Promise<boolean>,
  options: SnapshotOptions<Aggregate, StreamEvent, SnapshotStreamEvent>,
  ...events: StreamEvent[]
): Promise<boolean> {
  const appendEventsResult = await appendToStream<StreamEvent>(
    client,
    streamName,
    ...events
  );

  if (!appendEventsResult) return false;

  const { shouldDoSnapshot, buildSnapshotStreamName, doSnapshot } = options;

  const snapshots = events
    .map((event) => {
      if (!shouldDoSnapshot(streamName, event)) {
        return [];
      }
      const snapshot = doSnapshot(currentState, streamName, event);

      return snapshot ? [snapshot] : [];
    })
    .flat();

  if (snapshots.length > 0) {
    return (
      await appendToStream<SnapshotStreamEvent>(
        client,
        buildSnapshotStreamName(streamName),
        ...snapshots
      )
    ).success;
  }
  return true;
}

export async function snapshotOnSubscription<
  Aggregate extends Record<string, unknown> = Record<string, unknown>,
  StreamEvent extends Event = Event,
  SnapshotStreamEvent extends SnapshotEvent = SnapshotEvent
>(
  client: EventStoreDBClient,
  streamName: string,
  aggregateStream: (events: StreamEvent[]) => Aggregate,
  options: SnapshotOptions<Aggregate, StreamEvent, SnapshotStreamEvent>
): Promise<StreamSubscription> {
  const { shouldDoSnapshot, buildSnapshotStreamName, doSnapshot } = options;

  return subscribeToStream(
    client,
    streamName,
    async (event: StreamEvent, position: bigint) => {
      if (!shouldDoSnapshot(streamName, event)) {
        return;
      }
      const snapshotStreamName = buildSnapshotStreamName(streamName);

      const result = await readFromStream<SnapshotStreamEvent>(
        client,
        snapshotStreamName,
        {
          maxCount: 1,
          direction: 'backwards',
        }
      );

      const streamPositionFromSnapshot =
        result !== 'STREAM_NOT_FOUND'
          ? result[0].metadata.streamVersion
          : undefined;

      const eventsAfterSnapshot =
        streamPositionFromSnapshot === position - 1n
          ? []
          : await readFromStream<StreamEvent>(client, streamName, {
              fromRevision: streamPositionFromSnapshot,
              maxCount: position - (streamPositionFromSnapshot || 0n),
            });

      if (eventsAfterSnapshot == 'STREAM_NOT_FOUND') return;

      const currentState = aggregateStream([...eventsAfterSnapshot, event]);

      const snapshot = doSnapshot(currentState, streamName, event);

      await appendToStream<SnapshotStreamEvent>(
        client,
        buildSnapshotStreamName(streamName),
        snapshot
      );
    }
  );
}
