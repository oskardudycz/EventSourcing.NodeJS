import { EventStoreDBClient } from '@eventstore/db-client';
import { ReadFromStreamAndSnapshotsResult, SnapshotEvent } from '..';
import { Event } from '../../../events';
import { Result } from '../../../primitives';
import { ReadFromStreamOptions, STREAM_NOT_FOUND } from '../../reading';
import { readEventsFromExternalSnapshot } from './readEventsFromExternalSnapshot';
import { readSnapshotFromSeparateStream } from './readSnapshotFromSeparateStream';

export async function readEventsFromSnapshotInSeparateStream<
  StreamEventType extends Event,
  SnapshotStreamEvent extends SnapshotEvent = StreamEventType & SnapshotEvent
>(
  eventStore: EventStoreDBClient,
  streamName: string,
  readEventsOptions?: ReadFromStreamOptions,
  buildSnapshotStreamName?: (streamName: string) => string
): Promise<
  Result<
    ReadFromStreamAndSnapshotsResult<StreamEventType | SnapshotStreamEvent>,
    STREAM_NOT_FOUND
  >
> {
  return readEventsFromExternalSnapshot<StreamEventType, SnapshotStreamEvent>(
    (streamName) =>
      readSnapshotFromSeparateStream(
        eventStore,
        streamName,
        buildSnapshotStreamName
      ),
    eventStore,
    streamName,
    readEventsOptions
  );
}
