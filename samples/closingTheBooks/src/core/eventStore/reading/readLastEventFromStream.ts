import { BACKWARDS, END, EventStoreDBClient } from '@eventstore/db-client';
import { ReadStreamOptions } from '@eventstore/db-client/dist/streams';
import { Event, StreamEvent } from '../../events';
import { NO_EVENTS_FOUND, readFromStream, STREAM_NOT_FOUND } from '.';
import { failure, Result, success } from '../../primitives';

export async function readLastEventFromStream<StreamEventType extends Event>(
  eventStore: EventStoreDBClient,
  streamName: string,
  options?: ReadStreamOptions
): Promise<
  Result<StreamEvent<StreamEventType>, STREAM_NOT_FOUND | NO_EVENTS_FOUND>
> {
  const events = await readFromStream<StreamEventType>(eventStore, streamName, {
    maxCount: 1,
    direction: BACKWARDS,
    fromRevision: END,
    ...options,
  });

  if (events.isError) {
    return failure('STREAM_NOT_FOUND');
  }

  if (events.value.length === 0) return failure('NO_EVENTS_FOUND');

  return success(events.value[0]);
}
