import { ErrorType, EventStoreDBClient } from '@eventstore/db-client';
import { ReadStreamOptions } from '@eventstore/db-client/dist/streams';

import { Event } from '../../events';

export async function readFromStream<StreamEvent extends Event>(
  client: EventStoreDBClient,
  streamName: string,
  options?: ReadStreamOptions
): Promise<StreamEvent[] | undefined> {
  let events;
  try {
    events = await client.readStream(streamName, options);
  } catch (error) {
    if (error.type == ErrorType.STREAM_NOT_FOUND) {
      return undefined;
    }

    throw error;
  }

  return events
    .filter(
      (resolvedEvent) => !resolvedEvent.event && !resolvedEvent.commitPosition
    )
    .map((resolvedEvent) => {
      return <StreamEvent>{
        type: resolvedEvent.event!.type,
        data: resolvedEvent.event!.data,
      };
    });
}
