import {
  AllStreamSubscription,
  EventStoreDBClient,
  Position,
  START,
} from '@eventstore/db-client';
import { SubscribeToAllOptions } from '@eventstore/db-client/dist/streams';
import { ReadableOptions } from 'node:stream';

import { Event } from '../../events';
import { pipeResultAsync } from '../../primitives/pipe';
import { Result, success } from '../../primitives/result';
import { FAILED_TO_STORE_CHECKPOINT } from './checkpoints';

export async function subscribeToAll<StreamEvent extends Event>(
  eventStore: EventStoreDBClient,
  loadCheckpoint: (
    subscriptionId: string
  ) => Promise<Result<Position | undefined>>,
  storeCheckpoint: (
    subscriptionId: string,
    position: bigint
  ) => Promise<Result<true, FAILED_TO_STORE_CHECKPOINT>>,
  handlers: ((
    event: StreamEvent,
    options: { position: bigint; revision: bigint; streamName: string }
  ) => Promise<Result<boolean>>)[],
  subscriptionId: string,
  options?: SubscribeToAllOptions,
  readableOptions?: ReadableOptions
): Promise<Result<AllStreamSubscription>> {
  return pipeResultAsync(loadCheckpoint, async (currentPosition) => {
    return success(
      eventStore
        .subscribeToAll(
          { fromPosition: currentPosition || START, ...options },
          readableOptions
        )
        .on('data', async function (resolvedEvent) {
          if (!resolvedEvent.event) {
            console.log(`Event without data received`);
            return;
          }

          const event = {
            type: resolvedEvent.event.type,
            data: resolvedEvent.event.data,
          } as StreamEvent;

          for (const handleEvent of handlers) {
            //TODO: add here some retry logic
            await handleEvent(event, {
              position: resolvedEvent.event.position.commit,
              revision: resolvedEvent.event.revision,
              streamName: resolvedEvent.event.streamId,
            });
          }

          //TODO: add here some retry logic
          await storeCheckpoint(
            subscriptionId,
            resolvedEvent.event.position.commit
          );
        })
    );
  })(subscriptionId);
}
