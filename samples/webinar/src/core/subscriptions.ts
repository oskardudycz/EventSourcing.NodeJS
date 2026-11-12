import type {
  AllStreamResolvedEvent,
  KurrentDBClient,
} from '@kurrent/kurrentdb-client';
import { excludeSystemEvents, START } from '@kurrent/kurrentdb-client';

export type SubscriptionResolvedEvent = AllStreamResolvedEvent & {
  subscriptionId: string;
};

export type Checkpoint = { position: string };

export type EventHandler = (event: SubscriptionResolvedEvent) => Promise<void>;

export const SubscriptionToAll =
  (
    eventStore: KurrentDBClient,
    loadCheckpoint: (subscriptionId: string) => Promise<bigint | undefined>,
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

    void (async () => {
      try {
        for await (const resolvedEvent of subscription) {
          for (const handler of handlers) {
            await handler({ ...resolvedEvent, subscriptionId });
          }
        }
        console.info(`Stopping subscription.`);
      } catch (error) {
        console.error(`Received error: ${JSON.stringify(error)}.`);
      }
    })();
    return subscription;
  };
