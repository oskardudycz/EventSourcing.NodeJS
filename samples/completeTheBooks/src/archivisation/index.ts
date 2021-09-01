import {
  STREAM_NOT_FOUND,
  NO_EVENTS_FOUND,
  readFirstEventFromStream,
} from '#core/eventStore/reading';
import { Result, success } from '#core/primitives';
import { EventStoreDBClient } from '@eventstore/db-client';

export function getArchivisationScheduleStreamName(): string {
  return 'archivisation-scheduled';
}

export function getArchivisationForStreamName(streamName: string): string {
  return `archivisation_for-${streamName}`;
}

export async function getStreamRevisionOfTheFirstEventToArchive(
  eventStore: EventStoreDBClient,
  streamName: string
): Promise<Result<bigint, STREAM_NOT_FOUND | NO_EVENTS_FOUND>> {
  const archivisationForStreamName = getArchivisationForStreamName(streamName);

  const firstEvent = await readFirstEventFromStream(
    eventStore,
    archivisationForStreamName
  );

  if (firstEvent.isError) {
    return firstEvent;
  }

  return success(firstEvent.value.streamRevision);
}
