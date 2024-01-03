import { getEventStore } from '../..';
import { Event } from '../../../events';
import { STREAM_NOT_FOUND } from '../../reading';
import { Result } from '../../../primitives';
import {
  FAILED_TO_APPEND_SNAPSHOT,
  readEventsFromSnapshotInSeparateStream,
  SnapshotEvent,
  SNAPSHOT_CREATION_SKIPPED,
} from '..';
import { snapshotOnSubscription } from './snapshotOnSubscription';
import { appendSnapshotToStreamWithPrefix } from '../appending';

export async function snapshotOnSubscriptionToStreamWithPrefix<
  StreamEvent extends Event,
  SnapshotStreamEvent extends SnapshotEvent = StreamEvent & SnapshotEvent,
>(
  shouldDoSnapshot: (options: {
    newEvent: StreamEvent;
    currentStreamVersion: bigint;
    streamName: string;
  }) => boolean,
  buildSnapshot: (options: {
    newEvent: StreamEvent;
    currentEvents: (StreamEvent | SnapshotStreamEvent)[];
    currentStreamVersion: bigint;
    lastSnapshotVersion: bigint | undefined;
    streamName: string;
  }) => Result<SnapshotStreamEvent, SNAPSHOT_CREATION_SKIPPED>,
  newEvent: StreamEvent,
  options: { position: bigint; revision: bigint; streamName: string },
): Promise<Result<boolean, STREAM_NOT_FOUND | FAILED_TO_APPEND_SNAPSHOT>> {
  const eventStore = getEventStore();
  return snapshotOnSubscription<StreamEvent, SnapshotStreamEvent>(
    (...args) =>
      readEventsFromSnapshotInSeparateStream<StreamEvent, SnapshotStreamEvent>(
        ...args,
      ),
    (...args) => appendSnapshotToStreamWithPrefix(eventStore, ...args),
    shouldDoSnapshot,
    buildSnapshot,
    eventStore,
    newEvent,
    options,
  );
}
