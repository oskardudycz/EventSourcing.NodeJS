import {
  AppendResult,
  EventData,
  EventStoreDBClient,
  jsonEvent,
} from '@eventstore/db-client';

import { Event } from '../../../events';

export async function appendToStream<StreamEvent extends Event>(
  client: EventStoreDBClient,
  streamName: string,
  ...events: StreamEvent[]
): Promise<AppendResult> {
  const jsonEvents: EventData[] = events.map((event) =>
    jsonEvent({ type: event.type, data: event.data })
  );

  return client.appendToStream(streamName, jsonEvents);
}
