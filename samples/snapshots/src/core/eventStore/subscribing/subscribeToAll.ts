import type { KurrentDBClient, Position } from '@kurrent/kurrentdb-client';
import { excludeSystemEvents, START } from '@kurrent/kurrentdb-client';
import type { SubscribeToAllOptions } from '@kurrent/kurrentdb-client';
import type { ReadableOptions } from 'stream';

import type { Event } from '../../events';
import { pipeResultAsync } from '../../primitives/pipe';
import type { Result } from '../../primitives';
import { success } from '../../primitives';
import type { FAILED_TO_STORE_CHECKPOINT } from './checkpoints';

export async function subscribeToAll<StreamEvent extends Event, TError = never>(
  eventStore: KurrentDBClient,
  loadCheckpoint: (
    subscriptionId: string,
  ) => Promise<Result<Position | undefined>>,
  storeCheckpoint: (
    subscriptionId: string,
    position: bigint,
  ) => Promise<Result<true, FAILED_TO_STORE_CHECKPOINT>>,
  handlers: ((
    event: StreamEvent,
    options: { position: bigint; revision: bigint; streamName: string },
  ) => Promise<Result<boolean, TError>>)[],
  subscriptionId: string,
  options?: SubscribeToAllOptions,
  readableOptions?: ReadableOptions,
): Promise<Result<boolean>> {
  return new Promise<Result<boolean>>((resolve, reject) => {
    pipeResultAsync(loadCheckpoint, (currentPosition) => {
      return Promise.resolve(
        success(
          eventStore
            .subscribeToAll(
              {
                fromPosition: currentPosition || START,
                filter: excludeSystemEvents(),
                ...options,
              },
              readableOptions,
            )
            .on('data', async function (resolvedEvent) {
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
                await storeCheckpoint(
                  subscriptionId,
                  resolvedEvent.event.position.commit,
                );
              } catch (error) {
                console.error(
                  error ?? 'Error while processing subscription handler.',
                );
                throw error;
              }
            })
            .on('error', (error) => {
              console.error(`Received error: %s.`, error ?? 'UNEXPECTED ERROR');
              reject(error);
            })
            .on('close', () => {
              console.error(`Subscription closed.`);
              reject(new Error('Subscription closed.'));
            })
            .on('end', () => {
              console.info(`Received 'end' event. Stopping subscription.`);
              resolve(success(true));
            }),
        ),
      );
    })(subscriptionId).catch((error: Error) => {
      console.error(
        `Received error while subscribing: %s.`,
        error ?? 'UNEXPECTED ERROR',
      );
      reject(error);
    });
  });
}
