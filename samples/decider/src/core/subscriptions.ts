import {
  AllStreamResolvedEvent,
  EventStoreDBClient,
  excludeSystemEvents,
  START,
} from '@eventstore/db-client';
import { finished, Readable } from 'stream';

export type SubscriptionResolvedEvent = AllStreamResolvedEvent & {
  subscriptionId: string;
};

export type Checkpoint = { position: string };

export type EventHandler = (event: SubscriptionResolvedEvent) => Promise<void>;

export const SubscriptionToAll =
  (
    eventStore: EventStoreDBClient,
    loadCheckpoint: (subscriptionId: string) => Promise<bigint | undefined>,
    storeCheckpoint: (
      subscriptionId: string,
      position: bigint,
    ) => Promise<void>,
  ) =>
  async (subscriptionId: string, handlers: EventHandler[]) => {
    const currentPosition = await loadCheckpoint(subscriptionId);
    const fromPosition = !currentPosition
      ? START
      : { prepare: currentPosition, commit: currentPosition };

    const subscription = eventStore.subscribeToAll({
      fromPosition,
      filter: excludeSystemEvents(),
    });

    finished(
      subscription.on('data', async (resolvedEvent: AllStreamResolvedEvent) => {
        if (!resolvedEvent.event?.position.commit) return;
        for (const handler of handlers) {
          await handler({ ...resolvedEvent, subscriptionId });
        }
        await storeCheckpoint(
          subscriptionId,
          resolvedEvent.event?.position.commit,
        );
      }) as Readable,
      (error) => {
        if (!error) {
          console.info(`Stopping subscription.`);
          return;
        }
        console.error('Received error');
        console.error(error);
      },
    );
    return subscription;
  };
