import { EventStoreDBClient } from '@eventstore/db-client';
import { ReadStreamOptions } from '@eventstore/db-client/dist/streams';

import { Event } from '../../events';
import { readFromStream, STREAM_NOT_FOUND } from '.';
import { failed, failure, Result, success } from '../../primitives/result';

export type NO_EVENTS_FOUND = 'NO_EVENTS_FOUND';

export async function readLastEventFromStream<StreamEvent extends Event>(
  client: EventStoreDBClient,
  streamName: string,
  options?: ReadStreamOptions
): Promise<Result<StreamEvent, STREAM_NOT_FOUND | NO_EVENTS_FOUND>> {
  const stream = await readFromStream<StreamEvent>(client, streamName, {
    ...options,
    maxCount: 1,
    direction: 'backwards',
  });

  if (failed(stream)) {
    return stream;
  }
  const { value: events } = stream;

  if (events.length === 0) return failure('NO_EVENTS_FOUND');

  return success(events[0]);
}
