import { Result, success } from '#core/primitives';
import { StreamEvent } from '#core/events';
import { getEventStore } from '#core/eventStore';
import { Event } from '#core/events';
import {
  appendToStream,
  FAILED_TO_APPEND_EVENT,
} from '#core/eventStore/appending';
import {
  getArchivisationScheduleStreamName,
  getStreamRevisionOfTheFirstEventToArchive,
} from '../';
import { ArchiveStream, handleArchiveStream } from './handler';
import { NO_EVENTS_FOUND, STREAM_NOT_FOUND } from '#core/eventStore/reading';

export type StreamArchivisationScheduled = Event<
  'stream-archivisation-scheduled',
  {
    streamName: string;
    archiveBeforeRevision: string;
    scheduledAt: Date;
  }
>;

export function isStreamArchivisationScheduled(
  event: Event
): event is StreamArchivisationScheduled {
  return event.type === 'stream-archivisation-scheduled';
}

export async function handleStreamArchivisationScheduled(
  streamEvent: StreamEvent
): Promise<
  Result<boolean, FAILED_TO_APPEND_EVENT | STREAM_NOT_FOUND | NO_EVENTS_FOUND>
> {
  const { event } = streamEvent;

  if (!isStreamArchivisationScheduled(event)) {
    return success(false);
  }

  const { streamName, archiveBeforeRevision } = event.data;

  const command: ArchiveStream = {
    type: 'archive-stream',
    data: {
      streamName,
      archiveBeforeRevision: BigInt(archiveBeforeRevision),
    },
  };

  const eventStore = getEventStore();

  const archivingScheduled = await handleArchiveStream(
    (streamName) =>
      getStreamRevisionOfTheFirstEventToArchive(eventStore, streamName),
    command
  );

  if (archivingScheduled.isError) {
    return archivingScheduled;
  }

  const result = await appendToStream(
    eventStore,
    getArchivisationScheduleStreamName(),
    archivingScheduled.value
  );

  if (result.isError) {
    return result;
  }

  return success(true);
}
