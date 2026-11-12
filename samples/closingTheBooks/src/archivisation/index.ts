import type {
  STREAM_NOT_FOUND,
  NO_EVENTS_FOUND,
} from '#core/eventStore/reading';
import { readFirstEventFromStream } from '#core/eventStore/reading';
import type { Result } from '#core/primitives';
import { success } from '#core/primitives';
import type { KurrentDBClient } from '@kurrent/kurrentdb-client';

export function getArchivisationScheduleStreamName(): string {
  return 'archivisation-scheduled';
}

export function getArchivisationForStreamName(streamName: string): string {
  return `archivisation_for-${streamName}`;
}

export async function getStreamRevisionOfTheFirstEventToArchive(
  eventStore: KurrentDBClient,
  streamName: string,
): Promise<Result<bigint, STREAM_NOT_FOUND | NO_EVENTS_FOUND>> {
  const firstEvent = await readFirstEventFromStream(eventStore, streamName);

  if (firstEvent.isError) {
    return firstEvent;
  }

  return success(firstEvent.value.streamRevision);
}
