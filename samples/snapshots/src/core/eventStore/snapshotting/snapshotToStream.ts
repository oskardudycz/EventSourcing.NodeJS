import { EventStoreDBClient, StreamSubscription } from '@eventstore/db-client';
import { Event } from '../../events';
import { SnapshotEvent } from './snapshotEvent';
import { appendToStream } from '../appending/appendToStream';
import { readFromStream } from '../reading/readFromStream';
import { subscribeToStream } from '../subscribing/subscribeToStream';
import { aggregateStream } from '../../streams';

export const addSnapshotPrefixToStreamName = function <
  Aggregate,
  StreamEvent extends Event
>(streamName: string, _currentState: Aggregate, _event: StreamEvent): string {
  return `snapshot-${streamName}`;
};

export async function appendEventsAndSnapshotsToTheSameStream<
  Aggregate,
  StreamEvent extends Event,
  SnapshotStreamEvent extends SnapshotEvent
>(
  client: EventStoreDBClient,
  currentState: Aggregate,
  streamName: string,
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

  return appendToStream<StreamEvent | SnapshotStreamEvent>(
    client,
    streamName,
    ...eventsAndSnapshots
  );
}

export async function appendEventsAndSnapshotsToTheSeparateStreams<
  Aggregate,
  StreamEvent extends Event,
  SnapshotStreamEvent extends SnapshotEvent
>(
  client: EventStoreDBClient,
  currentState: Aggregate,
  streamName: string,
  buildSnapshotStreamName: (streamName: string) => string,
  tryDoSnapshot: (
    streamName: string,
    currentState: Aggregate,
    event: StreamEvent
  ) => SnapshotStreamEvent | undefined,
  ...events: StreamEvent[]
): Promise<boolean> {
  const appendEventsResult = await appendToStream<StreamEvent>(
    client,
    streamName,
    ...events
  );

  if (!appendEventsResult) return false;

  const snapshots = events
    .map((event) => {
      const snapshot = tryDoSnapshot(streamName, currentState, event);

      return snapshot ? [snapshot] : [];
    })
    .flat();

  if (snapshots.length > 0) {
    return appendToStream<SnapshotStreamEvent>(
      client,
      buildSnapshotStreamName(streamName),
      ...snapshots
    );
  }
  return true;
}

export async function snapshotOnSubscription<
  Aggregate,
  StreamEvent extends Event,
  SnapshotStreamEvent extends SnapshotEvent
>(
  client: EventStoreDBClient,
  streamName: string,
  buildSnapshotStreamName: (streamName: string) => string,
  shouldDoSnapshot: (streamName: string, event: StreamEvent) => boolean,
  doSnapshot: (
    streamName: string,
    currentState: Aggregate,
    event: StreamEvent
  ) => SnapshotStreamEvent,
  when: (
    currentState: Partial<Aggregate>,
    event: StreamEvent,
    currentIndex: number,
    allEvents: StreamEvent[]
  ) => Partial<Aggregate>
): Promise<StreamSubscription> {
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

      const currentState = aggregateStream<Aggregate, StreamEvent>(
        [...eventsAfterSnapshot, event],
        when
      );

      const snapshot = doSnapshot(streamName, currentState, event);

      await appendToStream<SnapshotStreamEvent>(
        client,
        buildSnapshotStreamName(streamName),
        snapshot
      );
    }
  );
}
