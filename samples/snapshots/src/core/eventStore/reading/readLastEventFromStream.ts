import { EventStoreDBClient } from '@eventstore/db-client';
import { ReadStreamOptions } from '@eventstore/db-client/dist/streams';

import { Event } from '../../events';
import { readFromStream, STREAM_NOT_FOUND } from '.';

export type NO_EVENTS_FOUND = 'NO_EVENTS_FOUND';

export async function readLastEventFromStream<StreamEvent extends Event>(
  client: EventStoreDBClient,
  streamName: string,
  options?: ReadStreamOptions
): Promise<StreamEvent | STREAM_NOT_FOUND | NO_EVENTS_FOUND> {
  const events = await readFromStream<StreamEvent>(client, streamName, {
    ...options,
    maxCount: 1,
    direction: 'backwards',
  });

  if (events === 'STREAM_NOT_FOUND') {
    return 'STREAM_NOT_FOUND';
  }

  if (events.length === 0) return 'NO_EVENTS_FOUND';

  return events[0];
}
