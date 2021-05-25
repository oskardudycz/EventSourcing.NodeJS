import { NO_SHAPSHOT_FOUND, SnapshotEvent } from '../../snapshotting';
import { Event } from '../../../events';
import { readFromStream, STREAM_NOT_FOUND } from '../../reading';
import { EventStoreDBClient } from '@eventstore/db-client';
import {
  readFromSnapshotAndStream as readFromSnapshotAndStreamGeneric,
  readSnapshotFromSeparateStream,
} from '../../snapshotting/reading';

export type ReadFromStreamAndSnapshotsResult<
  StreamEvent extends Event = Event
> = {
  events: StreamEvent[];
  lastSnapshotVersion?: bigint;
};

export async function readEventsFromSnapshot<
  StreamEvent extends Event,
  SnapshotStreamEvent extends SnapshotEvent = StreamEvent & SnapshotEvent
>(
  eventStore: EventStoreDBClient,
  getLastSnapshot: (
    streamName: string
  ) => Promise<SnapshotStreamEvent | NO_SHAPSHOT_FOUND>,
  streamName: string
): Promise<
  | ReadFromStreamAndSnapshotsResult<StreamEvent | SnapshotStreamEvent>
  | STREAM_NOT_FOUND
> {
  return readFromSnapshotAndStreamGeneric<StreamEvent, SnapshotStreamEvent>(
    getLastSnapshot,
    (streamName, fromRevision) =>
      readFromStream<StreamEvent>(eventStore, streamName, {
        fromRevision,
      }),
    streamName
  );
}

export async function readEventsFromSnapshotInSeparateStream<
  StreamEvent extends Event,
  SnapshotStreamEvent extends SnapshotEvent = StreamEvent & SnapshotEvent
>(
  eventStore: EventStoreDBClient,
  streamName: string,
  buildSnapshotStreamName?: (streamName: string) => string
): Promise<
  | ReadFromStreamAndSnapshotsResult<StreamEvent | SnapshotStreamEvent>
  | STREAM_NOT_FOUND
> {
  return readFromSnapshotAndStreamGeneric<StreamEvent, SnapshotStreamEvent>(
    (streamName) =>
      readSnapshotFromSeparateStream(
        eventStore,
        streamName,
        buildSnapshotStreamName
      ),
    (streamName, fromRevision) =>
      readFromStream<StreamEvent>(eventStore, streamName, {
        fromRevision,
      }),
    streamName
  );
}
