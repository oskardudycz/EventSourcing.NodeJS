import {
  AllStreamResolvedEvent,
  EventStoreDBClient,
  excludeSystemEvents,
  START,
} from '@eventstore/db-client';

export type SubscriptionResolvedEvent = AllStreamResolvedEvent & {
  subscriptionId: string;
};

export type Checkpoint = { position: string };

export type EventHandler = (event: SubscriptionResolvedEvent) => Promise<void>;

export const SubscriptionToAll =
  (
    eventStore: EventStoreDBClient,
    loadCheckpoint: (subscriptionId: string) => Promise<bigint | undefined>
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

    subscription
      .on('data', async (resolvedEvent: AllStreamResolvedEvent) => {
        for (const handler of handlers) {
          await handler({ ...resolvedEvent, subscriptionId });
        }
      })
      .on('error', async (error) => {
        console.error(`Received error: ${error ?? 'UNEXPECTED ERROR'}.`);
      })
      .on('close', async () => {
        console.info(`Subscription closed.`);
      })
      .on('end', () => {
        console.info(`Received 'end' event. Stopping subscription.`);
      });
    return subscription;
  };
