import { EventStoreDBClient } from '@eventstore/db-client';
import { Event } from '../../events';
import { appendToStream } from '../appending/appendToStream';
import { readFromStream } from '../reading/readFromStream';
import { subscribeToStream } from '../subscribing/subscribeToStream';

export const addSnapshotPrefixToStreamName = function <
  Aggregate,
  StreamEvent extends Event
>(streamName: string, _currentState: Aggregate, _event: StreamEvent): string {
  return `snapshot-${streamName}`;
};

export async function appendEventsAndSnapshotsToTheSameStream<
  Aggregate,
  StreamEvent extends Event
>(
  client: EventStoreDBClient,
  currentState: Aggregate,
  streamName: string,
  tryDoSnapshot: (
    streamName: string,
    currentState: Aggregate,
    event: StreamEvent
  ) => StreamEvent | undefined,
  ...events: StreamEvent[]
): Promise<boolean> {
  const eventsAndSnapshots = events
    .map((event) => {
      const snapshot = tryDoSnapshot(streamName, currentState, event);

      return snapshot ? [snapshot, event] : [event];
    })
    .flat();

  return appendToStream<StreamEvent>(client, streamName, ...eventsAndSnapshots);
}

export async function appendEventsAndSnapshotsToTheSeparateStreams<
  Aggregate,
  StreamEvent extends Event,
  SnapshotStreamEvent extends Event
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
  SnapshotStreamEvent extends Event
>(
  client: EventStoreDBClient,
  streamName: string,
  buildSnapshotStreamName: (streamName: string) => string,
  shouldDoSnapshot: (streamName: string, event: StreamEvent) => boolean,
  doSnapshot: (
    streamName: string,
    currentState: Aggregate,
    event: StreamEvent
  ) => SnapshotStreamEvent
): StreamSubscription {
  return subscribeToStream(
    client,
    streamName,
    async (event: StreamEvent, position: bigint) => {
      if (!shouldDoSnapshot(streamName, event)) {
        return;
      }
      const snapshotStreamName = buildSnapshotStreamName(streamName);

      const lastSnapshot = await readFromStream<SnapshotStreamEvent>(
        snapshotStreamName,
        {
          maxCount: 1,
          direction: 'backwards',
        }
      );

      const snapshot = tryDoSnapshot(streamName, currentState, event);
    }
  );
}
