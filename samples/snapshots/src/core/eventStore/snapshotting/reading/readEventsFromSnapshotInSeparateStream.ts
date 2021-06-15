import { EventStoreDBClient } from '@eventstore/db-client';
import { ReadFromStreamAndSnapshotsResult, SnapshotEvent } from '..';
import { Event } from '../../../events';
import { Result } from '../../../primitives/result';
import { ReadFromStreamOptions, STREAM_NOT_FOUND } from '../../reading';
import { readEventsFromSeparateSnapshot } from './readEventsFromSeparateSnapshot';
import { readSnapshotFromSeparateStream } from './readSnapshotFromSeparateStream';

export async function readEventsFromSnapshotInSeparateStream<
  StreamEvent extends Event,
  SnapshotStreamEvent extends SnapshotEvent = StreamEvent & SnapshotEvent
>(
  eventStore: EventStoreDBClient,
  streamName: string,
  readEventsOptions?: ReadFromStreamOptions,
  buildSnapshotStreamName?: (streamName: string) => string
): Promise<
  Result<
    ReadFromStreamAndSnapshotsResult<StreamEvent | SnapshotStreamEvent>,
    STREAM_NOT_FOUND
  >
> {
  return readEventsFromSeparateSnapshot<StreamEvent, SnapshotStreamEvent>(
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
