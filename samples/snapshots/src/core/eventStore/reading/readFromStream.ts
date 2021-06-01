import { ErrorType, EventStoreDBClient } from '@eventstore/db-client';
import { ReadStreamOptions } from '@eventstore/db-client/dist/streams';

import { Event } from '../../events';

export type STREAM_NOT_FOUND = 'STREAM_NOT_FOUND';

export async function readFromStream<StreamEvent extends Event>(
  client: EventStoreDBClient,
  streamName: string,
  options?: ReadStreamOptions
): Promise<StreamEvent[] | STREAM_NOT_FOUND> {
  let events;
  try {
    events = await client.readStream(streamName, options);
  } catch (error) {
    if (error.type == ErrorType.STREAM_NOT_FOUND) {
      return 'STREAM_NOT_FOUND';
    }

    throw error;
  }

  return events
    .filter((resolvedEvent) => !!resolvedEvent.event)
    .map((resolvedEvent) => {
      return <StreamEvent>{
        type: resolvedEvent.event!.type,
        data: resolvedEvent.event!.data,
      };
    });
}
