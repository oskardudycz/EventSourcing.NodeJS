import { END, EventStoreDBClient } from '@eventstore/db-client';
import { ReadStreamOptions } from '@eventstore/db-client/dist/streams';

import { Event } from '../../events';
import { readFromStream, STREAM_NOT_FOUND } from '.';
import { failure, Result, success } from '../../primitives/result';

export type NO_EVENTS_FOUND = 'NO_EVENTS_FOUND';

export async function readLastEventFromStream<StreamEvent extends Event>(
  eventStore: EventStoreDBClient,
  streamName: string,
  options?: ReadStreamOptions
): Promise<Result<StreamEvent, STREAM_NOT_FOUND | NO_EVENTS_FOUND>> {
  const events = await readFromStream<StreamEvent>(eventStore, streamName, {
    maxCount: 1,
    direction: 'backwards',
    fromRevision: END,
    ...options,
  });

  if (events.isError) {
    return failure('STREAM_NOT_FOUND');
  }

  if (events.value.length === 0) return failure('NO_EVENTS_FOUND');

  return success(events.value[0]);
}
