import { Result, success } from '#core/primitives';
import { StreamEvent } from '#core/events';
import {
  FAILED_TO_APPEND_EVENT,
  setStreamMetadata,
} from '#core/eventStore/appending';
import {
  NO_EVENTS_FOUND,
  readFromStream,
  STREAM_NOT_FOUND,
} from '#core/eventStore/reading';
import { isStreamBatchArchivisationScheduled } from '../schedulingArchivisation/handler';
import { getEventStore } from '#core/eventStore';

export async function handleStreamBatchArchivisationScheduled(
  streamEvent: StreamEvent
): Promise<
  Result<boolean, FAILED_TO_APPEND_EVENT | STREAM_NOT_FOUND | NO_EVENTS_FOUND>
> {
  const {
    event,
    streamRevision: archivisationStreamRevision,
    streamName: archivisationStreamName,
  } = streamEvent;

  if (!isStreamBatchArchivisationScheduled(event)) {
    return success(false);
  }

  const { streamName: streamToArchiveName } = event.data;
  const fromRevision = BigInt(event.data.fromRevision);
  const beforeRevision = BigInt(event.data.beforeRevision);

  const eventStore = getEventStore();

  const readResult = await readFromStream(eventStore, streamToArchiveName, {
    fromRevision,
    maxCount: beforeRevision - fromRevision,
  });

  if (readResult.isError) {
    return readResult;
  }

  const events = readResult.value;

  await copyEventsToColdStorage(events);

  await setStreamMetadata(eventStore, streamToArchiveName, {
    truncateBefore: Number(beforeRevision),
  });

  await setStreamMetadata(eventStore, archivisationStreamName, {
    truncateBefore: Number(archivisationStreamRevision),
  });

  return success(true);
}

async function copyEventsToColdStorage(_events: StreamEvent[]): Promise<void> {
  console.log('copy it somewhere nice and let them rest in peace');
}
