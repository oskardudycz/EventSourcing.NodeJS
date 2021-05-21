import { EventStoreDBClient, StreamSubscription } from '@eventstore/db-client';
import {
  NO_SHAPSHOT_FOUND,
  readFromSnapshotAndStream,
  SnapshotEvent,
} from '..';
import { SnapshotOptions } from './appendEventAndSeparateSnapshot';
import { Event } from '../../../events';
import { subscribeToStream } from '../../subscribing/subscribeToStream';
import { aggregateStream } from '../../../streams';

export async function appendSnapshotOnSubscription<
  Aggregate extends Record<string, unknown> = Record<string, unknown>,
  StreamEvent extends Event = Event,
  SnapshotStreamEvent extends SnapshotEvent = SnapshotEvent
>(
  eventStore: EventStoreDBClient,
  streamName: string,
  getLastSnapshot: (
    streamName: string
  ) => Promise<SnapshotStreamEvent | NO_SHAPSHOT_FOUND>,
  when: (
    currentState: Partial<Aggregate>,
    event: StreamEvent | SnapshotEvent
  ) => Aggregate,
  options: SnapshotOptions<Aggregate, StreamEvent, SnapshotStreamEvent>
): Promise<StreamSubscription | 'STREAM_NOT_FOUND'> {
  const { shouldDoSnapshot, buildSnapshot, appendSnapshot } = options;

  const currentEvents = await readFromSnapshotAndStream<
    StreamEvent,
    SnapshotStreamEvent
  >(eventStore, streamName, getLastSnapshot);

  // check if you can subscribe to stream when it does not exist
  // category stream
  if (currentEvents === 'STREAM_NOT_FOUND') {
    return 'STREAM_NOT_FOUND';
  }

  let { events, lastSnapshotVersion } = currentEvents;

  let currentState = aggregateStream<
    Aggregate,
    StreamEvent | SnapshotStreamEvent
  >(events, when);

  return subscribeToStream(
    eventStore,
    streamName,
    async (event: StreamEvent, position: bigint) => {
      if (
        !shouldDoSnapshot(
          event,
          lastSnapshotVersion,
          position,
          streamName,
          currentState
        )
      ) {
        events = [...events, event];
        return;
      }

      const snapshot = buildSnapshot(currentState, position, streamName, event);

      await appendSnapshot(snapshot, streamName);

      events = [snapshot];
    },
    { fromRevision: lastSnapshotVersion }
  );
}
