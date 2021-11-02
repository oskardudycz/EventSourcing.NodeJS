import {
  EventStoreDBClient,
  Position,
  StreamSubscription,
} from '@eventstore/db-client';
import { SubscribeToStreamOptions } from '@eventstore/db-client/dist/streams';

import { Event, StreamEvent } from '../../events';
import { pipeResultAsync } from '../../primitives/pipe';
import { Result, success } from '../../primitives';
import { FAILED_TO_STORE_CHECKPOINT } from './checkpoints';

export async function subscribeToStream(
  loadCheckpoint: (
    subscriptionId: string
  ) => Promise<Result<Position | undefined>>,
  storeCheckpoint: (
    subscriptionId: string,
    revision: bigint
  ) => Promise<Result<true, FAILED_TO_STORE_CHECKPOINT>>,
  client: EventStoreDBClient,
  streamName: string,
  subscriptionId: string,
  handleEvent: (event: StreamEvent) => Promise<void>,
  options?: SubscribeToStreamOptions
): Promise<Result<StreamSubscription>> {
  return pipeResultAsync(loadCheckpoint, async (currentPosition) => {
    return success(
      client
        .subscribeToStream(streamName, options)
        .on('data', async function (resolvedEvent) {
          if (!resolvedEvent.event) {
            console.log(`Event without data received`);
            return;
          }

          const event = {
            streamRevision: resolvedEvent.event!.revision,
            streamName: resolvedEvent.event!.streamId,
            event: <Event>{
              type: resolvedEvent.event!.type,
              data: resolvedEvent.event!.data,
              metadata: resolvedEvent.event!.metadata,
            },
          };

          //TODO: add here some retry logic
          await handleEvent(event);

          //TODO: add here some retry logic
          await storeCheckpoint(subscriptionId, resolvedEvent.event.revision);
        })
    );
  })(subscriptionId);
}
