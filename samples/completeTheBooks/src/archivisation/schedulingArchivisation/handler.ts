import { Command } from '#core/commands';
import { Event } from '#core/events';
import { NO_EVENTS_FOUND, STREAM_NOT_FOUND } from '#core/eventStore/reading';
import {
  Result,
  success,
  getCurrentTime,
  getNumberRanges,
} from '#core/primitives';

export type ScheduleStreamBatchArchivisation = Command<
  'schedule-batch-stream-archivisation',
  {
    streamName: string;
    archiveBeforeRevision: bigint;
  }
>;

export type StreamBatchArchivisationScheduled = Event<
  'stream-batch-archivisation-scheduled',
  {
    streamName: string;
    fromRevision: string;
    beforeRevision: string;
    scheduledAt: Date;
  }
>;

export function isStreamBatchArchivisationScheduled(
  event: Event
): event is StreamBatchArchivisationScheduled {
  return event.type === 'stream-batch-archivisation-scheduled';
}

export async function handleScheduleStreamBatchArchivisation(
  getStreamRevisionOfTheFirstEvent: (
    streamName: string
  ) => Promise<Result<bigint, STREAM_NOT_FOUND | NO_EVENTS_FOUND>>,
  command: ScheduleStreamBatchArchivisation
): Promise<
  Result<
    StreamBatchArchivisationScheduled[],
    STREAM_NOT_FOUND | NO_EVENTS_FOUND
  >
> {
  const { streamName, archiveBeforeRevision } = command.data;

  const fromRevision = await getStreamRevisionOfTheFirstEvent(streamName);

  if (fromRevision.isError) return fromRevision;

  const events: StreamBatchArchivisationScheduled[] = getNumberRanges(
    fromRevision.value,
    archiveBeforeRevision
  ).map(({ from, to }) => {
    return {
      type: 'stream-batch-archivisation-scheduled',
      data: {
        streamName,
        fromRevision: from.toString(),
        beforeRevision: to.toString(),
        scheduledAt: getCurrentTime(),
      },
    };
  });

  return success(events);
}
