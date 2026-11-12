import type { KurrentDBClient } from '@kurrent/kurrentdb-client';
import type { ReadFromStreamAndSnapshotsResult, SnapshotEvent } from '..';
import type { Event } from '../../../events';
import type { Result } from '../../../primitives';
import type { ReadFromStreamOptions, STREAM_NOT_FOUND } from '../../reading';
import { readEventsFromExternalSnapshot } from './readEventsFromExternalSnapshot';
import { readSnapshotFromSeparateStream } from './readSnapshotFromSeparateStream';

export async function readEventsFromSnapshotInSeparateStream<
  StreamEventType extends Event,
  SnapshotStreamEvent extends SnapshotEvent = StreamEventType & SnapshotEvent,
>(
  eventStore: KurrentDBClient,
  streamName: string,
  readEventsOptions?: ReadFromStreamOptions,
  buildSnapshotStreamName?: (streamName: string) => string,
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
        buildSnapshotStreamName,
      ),
    eventStore,
    streamName,
    readEventsOptions,
  );
}
