import type {
  KurrentDBClient,
  Position,
  StreamSubscription,
} from '@kurrent/kurrentdb-client';
import type { SubscribeToStreamOptions } from '@kurrent/kurrentdb-client';

import type { Event } from '../../events';
import { pipeResultAsync } from '../../primitives/pipe';
import type { Result } from '../../primitives';
import { success } from '../../primitives';
import type { FAILED_TO_STORE_CHECKPOINT } from './checkpoints';

export async function subscribeToStream<StreamEvent extends Event>(
  loadCheckpoint: (
    subscriptionId: string,
  ) => Promise<Result<Position | undefined>>,
  storeCheckpoint: (
    subscriptionId: string,
    revision: bigint,
  ) => Promise<Result<true, FAILED_TO_STORE_CHECKPOINT>>,
  client: KurrentDBClient,
  streamName: string,
  subscriptionId: string,
  handleEvent: (
    event: StreamEvent,
    options: { revision: bigint; streamName: string },
  ) => Promise<void>,
  options?: SubscribeToStreamOptions,
): Promise<Result<StreamSubscription>> {
  return pipeResultAsync(loadCheckpoint, (_currentPosition) => {
    return Promise.resolve(
      success(
        client
          .subscribeToStream(streamName, options)
          .on('data', async function (resolvedEvent) {
            if (!resolvedEvent.event) {
              console.log(`Event without data received`);
              return;
            }

            const event = {
              type: resolvedEvent.event.type,
              data: resolvedEvent.event.data,
            } as StreamEvent;

            //TODO: add here some retry logic
            await handleEvent(event, {
              revision: resolvedEvent.event.revision,
              streamName,
            });

            //TODO: add here some retry logic
            await storeCheckpoint(subscriptionId, resolvedEvent.event.revision);
          }),
      ),
    );
  })(subscriptionId);
}
