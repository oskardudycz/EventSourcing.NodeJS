import { EventStoreDBClient, FORWARDS, START } from '@eventstore/db-client';
import { ReadStreamOptions } from '@eventstore/db-client/dist/streams';

import { Event, StreamEvent } from '../../events';
import { readFromStream, STREAM_NOT_FOUND } from '.';
import { failure, Result, success } from '../../primitives';

export type NO_EVENTS_FOUND = 'NO_EVENTS_FOUND';

export async function readFirstEventFromStream<StreamEventType extends Event>(
  eventStore: EventStoreDBClient,
  streamName: string,
  options?: ReadStreamOptions
): Promise<
  Result<StreamEvent<StreamEventType>, STREAM_NOT_FOUND | NO_EVENTS_FOUND>
> {
  const events = await readFromStream<StreamEventType>(eventStore, streamName, {
    maxCount: 1,
    direction: FORWARDS,
    fromRevision: START,
    ...options,
  });

  if (events.isError) {
    return failure('STREAM_NOT_FOUND');
  }

  if (events.value.length === 0) return failure('NO_EVENTS_FOUND');

  return success(events.value[0]);
}
