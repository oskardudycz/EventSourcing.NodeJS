import {
  EventData,
  EventStoreDBClient,
  jsonEvent,
} from '@eventstore/db-client';

import { Event } from '../../events';

export async function appendToStream<StreamEvent extends Event>(
  client: EventStoreDBClient,
  streamName: string,
  ...events: StreamEvent[]
): Promise<boolean> {
  const jsonEvents: EventData[] = events.map((event) =>
    jsonEvent({ type: event.type, data: event.data })
  );

  const result = await client.appendToStream(streamName, jsonEvents);

  return result.success;
}
