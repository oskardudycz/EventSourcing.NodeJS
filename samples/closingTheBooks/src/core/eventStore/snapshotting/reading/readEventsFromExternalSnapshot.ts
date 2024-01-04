import { EventStoreDBClient } from '@eventstore/db-client';
import {
  NO_SHAPSHOT_FOUND,
  ReadFromStreamAndSnapshotsResult,
  SnapshotEvent,
} from '..';
import { Event, StreamEvent } from '../../../events';
import { Result, success } from '../../../primitives';
import {
  readFromStream,
  ReadFromStreamOptions,
  STREAM_NOT_FOUND,
} from '../../reading';

export async function readEventsFromExternalSnapshot<
  StreamEventType extends Event,
  SnapshotStreamEvent extends SnapshotEvent = StreamEventType & SnapshotEvent,
>(
  getLastSnapshot: (
    streamName: string,
  ) => Promise<Result<StreamEvent<SnapshotStreamEvent>, NO_SHAPSHOT_FOUND>>,
  eventStore: EventStoreDBClient,
  streamName: string,
  readEventsOptions?: ReadFromStreamOptions,
): Promise<
  Result<
    ReadFromStreamAndSnapshotsResult<StreamEventType | SnapshotStreamEvent>,
    STREAM_NOT_FOUND
  >
> {
  const snapshot = await getLastSnapshot(streamName);

  let snapshotEvent: StreamEvent<SnapshotStreamEvent> | undefined = undefined;
  let lastSnapshotVersion: bigint | undefined = undefined;

  if (snapshot.isError === false) {
    snapshotEvent = snapshot.value;
    lastSnapshotVersion = BigInt(
      snapshotEvent.event.metadata.snapshottedStreamVersion,
    );
  }

  const events = await readFromStream<StreamEventType>(eventStore, streamName, {
    fromRevision:
      lastSnapshotVersion !== undefined ? lastSnapshotVersion + 1n : undefined,
    ...readEventsOptions,
  });

  if (events.isError == true) {
    return events;
  }

  return success({
    events: snapshotEvent ? [snapshotEvent, ...events.value] : events.value,
    lastSnapshotVersion,
  });
}
