import type { KurrentDBClient } from '@kurrent/kurrentdb-client';
import type { Event } from '../../../events';
import type {
  FAILED_TO_APPEND_SNAPSHOT,
  SnapshotEvent,
  SNAPSHOT_CREATION_SKIPPED,
} from '..';
import type { FAILED_TO_APPEND_EVENT } from '../../appending/appendToStream';
import type { Result } from '../../../primitives';
import { appendEventAndExternalSnapshot } from './appendEventAndExternalSnapshot';
import { appendSnapshotToStreamWithPrefix } from './appendSnapshotToStreamWithPrefix';

export async function appendEventAndSnapshotToStreamWithPrefix<
  StreamEvent extends Event = Event,
  SnapshotStreamEvent extends SnapshotEvent = StreamEvent & SnapshotEvent,
>(
  tryBuildSnapshot: (options: {
    newEvent: StreamEvent;
    currentEvents: StreamEvent[];
    currentStreamVersion: bigint;
    lastSnapshotVersion: bigint | undefined;
    streamName: string;
  }) => Result<SnapshotStreamEvent, SNAPSHOT_CREATION_SKIPPED>,
  eventStore: KurrentDBClient,
  streamName: string,
  currentEvents: StreamEvent[],
  event: StreamEvent,
  lastSnapshotVersion?: bigint,
): Promise<
  Result<boolean, FAILED_TO_APPEND_EVENT | FAILED_TO_APPEND_SNAPSHOT>
> {
  return appendEventAndExternalSnapshot(
    (...args) => appendSnapshotToStreamWithPrefix(eventStore, ...args),
    tryBuildSnapshot,
    eventStore,
    streamName,
    currentEvents,
    lastSnapshotVersion,
    event,
  );
}
