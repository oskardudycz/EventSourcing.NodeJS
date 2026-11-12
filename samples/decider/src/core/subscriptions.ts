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

    void (async () => {
      try {
        for await (const resolvedEvent of subscription) {
          if (!resolvedEvent.event?.position.commit) continue;
          for (const handler of handlers) {
            await handler({ ...resolvedEvent, subscriptionId });
          }
          await storeCheckpoint(
            subscriptionId,
            resolvedEvent.event?.position.commit,
          );
        }
        console.info(`Stopping subscription.`);
      } catch (error) {
        console.error('Received error');
        console.error(error);
      }
    })();
    return subscription;
  };
