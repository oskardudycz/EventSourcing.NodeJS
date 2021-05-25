import { ReadFromStreamAndSnapshotsResult } from '../snapshotting/reading/';
import { Event, isEvent } from '../../events';
import { STREAM_NOT_FOUND } from '../reading';

export async function getAndUpdate<
  Command,
  StreamEvent extends Event,
  Error = never
>(
  getEvents: (
    streamName: string
  ) => Promise<
    ReadFromStreamAndSnapshotsResult<StreamEvent> | STREAM_NOT_FOUND
  >,
  store: (
    streamName: string,
    newEvent: StreamEvent,
    currentEvents: StreamEvent[],
    lastSnapshotVersion?: bigint | undefined
  ) => Promise<boolean>,
  streamName: string,
  command: Command,
  handle: (
    currentEvents: StreamEvent[],
    command: Command
  ) => StreamEvent | Error
): Promise<boolean | STREAM_NOT_FOUND | Error | never> {
  const stream = await getEvents(streamName);

  if (stream === 'STREAM_NOT_FOUND') {
    return 'STREAM_NOT_FOUND';
  }

  const { events, lastSnapshotVersion } = stream;

  const newEvent = handle(events, command);

  if (!isEvent(newEvent)) {
    return newEvent;
  }

  return await store(streamName, newEvent, events, lastSnapshotVersion);
}
