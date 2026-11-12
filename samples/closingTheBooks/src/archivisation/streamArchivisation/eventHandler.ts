import type { Result } from '#core/primitives';
import { success } from '#core/primitives';
import type { StreamEvent } from '#core/events';
import type { FAILED_TO_APPEND_EVENT } from '#core/eventStore/appending';
import { setStreamMetadata } from '#core/eventStore/appending';
import type {
  NO_EVENTS_FOUND,
  STREAM_NOT_FOUND,
} from '#core/eventStore/reading';
import { readFromStream } from '#core/eventStore/reading';
import { isStreamBatchArchivisationScheduled } from '../schedulingArchivisation/handler';
import { getEventStore } from '#core/eventStore';

export async function handleStreamBatchArchivisationScheduled(
  streamEvent: StreamEvent,
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

function copyEventsToColdStorage(_events: StreamEvent[]): Promise<void> {
  console.log('copy it somewhere nice and let them rest in peace');
  return Promise.resolve();
}
