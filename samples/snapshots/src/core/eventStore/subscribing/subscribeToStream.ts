import { EventStoreDBClient, StreamSubscription } from '@eventstore/db-client';

import { Event } from '../../events';

export async function subscribeToStream<StreamEvent extends Event>(
  client: EventStoreDBClient,
  streamName: string,
  handleEvent: (event: StreamEvent, position: bigint) => Promise<void>
): Promise<StreamSubscription> {
  return client
    .subscribeToStream(streamName)
    .on('data', function (resolvedEvent) {
      if (!resolvedEvent.event) {
        console.log(`Event without data received`);
        return;
      }
      if (!resolvedEvent.commitPosition) {
        console.log(`Event without data received`);
        return;
      }

      const event = {
        type: resolvedEvent.event.type,
        data: resolvedEvent.event.data,
      } as StreamEvent;

      handleEvent(event, resolvedEvent.commitPosition);
    });
}
