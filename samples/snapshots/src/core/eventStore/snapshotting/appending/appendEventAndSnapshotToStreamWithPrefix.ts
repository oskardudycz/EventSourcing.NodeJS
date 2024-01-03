import { EventStoreDBClient } from '@eventstore/db-client';
import { Event } from '../../../events';
import {
  FAILED_TO_APPEND_SNAPSHOT,
  SnapshotEvent,
  SNAPSHOT_CREATION_SKIPPED,
} from '..';
import { FAILED_TO_APPEND_EVENT } from '../../appending/appendToStream';
import { Result } from '../../../primitives';
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
  eventStore: EventStoreDBClient,
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
