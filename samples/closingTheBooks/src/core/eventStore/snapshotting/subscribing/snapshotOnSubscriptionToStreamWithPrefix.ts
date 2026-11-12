import { getEventStore } from '../..';
import type { Event, StreamEvent } from '../../../events';
import type { STREAM_NOT_FOUND } from '../../reading';
import type { Result } from '../../../primitives';
import type {
  FAILED_TO_APPEND_SNAPSHOT,
  SnapshotEvent,
  SNAPSHOT_CREATION_SKIPPED,
} from '..';
import { readEventsFromSnapshotInSeparateStream } from '..';
import { snapshotOnSubscription } from './snapshotOnSubscription';
import { appendSnapshotToStreamWithPrefix } from '../appending';

export async function snapshotOnSubscriptionToStreamWithPrefix<
  StreamEventType extends Event,
  SnapshotStreamEvent extends SnapshotEvent = StreamEventType & SnapshotEvent,
>(
  shouldDoSnapshot: (options: {
    newEvent: StreamEventType;
    currentStreamVersion: bigint;
    streamName: string;
  }) => boolean,
  buildSnapshot: (options: {
    newEvent: StreamEventType;
    currentEvents: StreamEvent<StreamEventType | SnapshotStreamEvent>[];
    currentStreamVersion: bigint;
    lastSnapshotVersion: bigint | undefined;
    streamName: string;
  }) => Result<SnapshotStreamEvent, SNAPSHOT_CREATION_SKIPPED>,
  newEvent: StreamEventType,
  options: { position: bigint; revision: bigint; streamName: string },
): Promise<Result<boolean, STREAM_NOT_FOUND | FAILED_TO_APPEND_SNAPSHOT>> {
  const eventStore = getEventStore();
  return snapshotOnSubscription<StreamEventType, SnapshotStreamEvent>(
    (...args) =>
      readEventsFromSnapshotInSeparateStream<
        StreamEventType,
        SnapshotStreamEvent
      >(...args),
    (...args) => appendSnapshotToStreamWithPrefix(eventStore, ...args),
    shouldDoSnapshot,
    buildSnapshot,
    eventStore,
    newEvent,
    options,
  );
}
