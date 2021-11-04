import {
  AllStreamResolvedEvent,
  AllStreamSubscription,
  EventStoreDBClient,
  excludeSystemEvents,
  Position,
  START,
} from '@eventstore/db-client';
import { SubscribeToAllOptions } from '@eventstore/db-client/dist/streams';
import { ReadableOptions } from 'stream';
import { v4 as uuid } from 'uuid';
import { Event, StreamEvent } from '../../events';
import { Result, success } from '../../primitives';
import { FAILED_TO_STORE_CHECKPOINT } from './checkpoints';
import { Subscription } from './subscription';

export function getSubscriptionToAll<TError = never>(
  eventStore: EventStoreDBClient,
  loadCheckpoint: (
    subscriptionId: string
  ) => Promise<Result<Position | undefined>>,
  storeCheckpoint: (
    subscriptionId: string,
    position: bigint
  ) => Promise<Result<true, FAILED_TO_STORE_CHECKPOINT>>,
  handlers: ((event: StreamEvent) => Promise<Result<boolean, TError>>)[],
  subscriptionId: string = uuid(),
  options?: SubscribeToAllOptions,
  readableOptions?: ReadableOptions
): Result<Subscription> {
  return success(
    new Subscription(async () => {
      try {
        const checkpointResult = await loadCheckpoint(subscriptionId);

        if (checkpointResult.isError) {
          return checkpointResult;
        }

        const currentPosition = checkpointResult.value;

        const subscription = eventStore.subscribeToAll(
          {
            fromPosition: currentPosition || START,
            filter: excludeSystemEvents(),
            ...options,
          },
          readableOptions
        );

        subscription.on(
          'data',
          handleEvent<TError>(subscription, handlers, (position) =>
            storeCheckpoint(subscriptionId, position)
          )
        );

        return success(subscription);
      } catch (error) {
        console.error(
          `Received error while subscribing: ${error ?? 'UNEXPECTED ERROR'}.`
        );
        throw error;
      }
    })
  );
}

function handleEvent<TError = never>(
  subscription: AllStreamSubscription,
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

      const event: StreamEvent = {
        streamRevision: resolvedEvent.event!.revision,
        streamName: resolvedEvent.event!.streamId,
        event: <Event>{
          type: resolvedEvent.event!.type,
          data: resolvedEvent.event!.data,
          metadata: resolvedEvent.event!.metadata,
        },
      };

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
      if (!subscription.destroyed) throw error;
    }
  };
}
