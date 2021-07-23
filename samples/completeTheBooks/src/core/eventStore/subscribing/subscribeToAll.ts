import {
  AllStreamResolvedEvent,
  EventStoreDBClient,
  excludeSystemEvents,
  Position,
  START,
} from '@eventstore/db-client';
import { SubscribeToAllOptions } from '@eventstore/db-client/dist/streams';
import { v4 as uuid } from 'uuid';
import { ReadableOptions } from 'node:stream';

import { Event } from '../../events';
import { pipeResultAsync } from '../../primitives/pipe';
import { Result, success } from '../../primitives';
import { FAILED_TO_STORE_CHECKPOINT } from './checkpoints';
import { resubscribeOnError } from './resubscribeOnError';

export async function subscribeToAll<StreamEvent extends Event, TError = never>(
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
  ) => Promise<Result<boolean, TError>>)[],
  subscriptionId: string = uuid(),
  options?: SubscribeToAllOptions,
  readableOptions?: ReadableOptions
): Promise<Result<boolean>> {
  return resubscribeOnError(
    () =>
      new Promise<Result<boolean>>(async (resolve, reject) => {
        try {
          await pipeResultAsync(loadCheckpoint, async (currentPosition) => {
            return success(
              eventStore
                .subscribeToAll(
                  {
                    fromPosition: currentPosition || START,
                    filter: excludeSystemEvents(),
                    ...options,
                  },
                  readableOptions
                )
                .on(
                  'data',
                  handleEvent<StreamEvent, TError>(handlers, (position) =>
                    storeCheckpoint(subscriptionId, position)
                  )
                )
                .on('error', async (error) => {
                  console.error(
                    `Received error: ${error ?? 'UNEXPECTED ERROR'}.`
                  );
                  reject(error);
                })
                .on('close', async () => {
                  console.error(`Subscription closed.`);
                  reject();
                })
                .on('end', () => {
                  console.info(`Received 'end' event. Stopping subscription.`);
                  resolve(success(true));
                })
            );
          })(subscriptionId);
        } catch (error) {
          console.error(
            `Received error while subscribing: ${error ?? 'UNEXPECTED ERROR'}.`
          );
          reject(error);
        }
      })
  );
}
function handleEvent<StreamEvent extends Event, TError = never>(
  handlers: ((
    event: StreamEvent,
    options: {
      position: bigint;
      revision: bigint;
      streamName: string;
    }
  ) => Promise<Result<boolean, TError>>)[],
  storeCheckpoint: (
    position: bigint
  ) => Promise<Result<true, FAILED_TO_STORE_CHECKPOINT>>
) {
  return async function (resolvedEvent: AllStreamResolvedEvent) {
    try {
      if (!resolvedEvent.event) {
        console.log('Event without data received');
        return;
      }

      if (resolvedEvent.event.type == 'check-point') {
        console.log('Checkpoint event - ignoring');
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
      await storeCheckpoint(resolvedEvent.event.position.commit);
    } catch (error) {
      console.error(error ?? 'Error while processing subscription handler.');
      throw error;
    }
  };
}
