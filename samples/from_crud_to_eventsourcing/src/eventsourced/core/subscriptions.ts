import { getPostgres } from '#core/postgres';
import { retryPromise } from '#core/retries';
import type { Transaction } from '@databases/pg';
import type {
  AllStreamResolvedEvent,
  KurrentDBClient,
} from '@kurrent/kurrentdb-client';
import { excludeSystemEvents, START } from '@kurrent/kurrentdb-client';
import { subscriptionCheckpoints } from '../db';
import { getEventStore } from './streams';

export type SubscriptionResolvedEvent = AllStreamResolvedEvent & {
  subscriptionId: string;
};

export type Checkpoint = { position: string };

export type EventHandler = (event: SubscriptionResolvedEvent) => Promise<void>;

export const SubscriptionToAll =
  (
    getEventStore: () => KurrentDBClient,
    loadCheckpoint: (subscriptionId: string) => Promise<bigint | undefined>,
  ) =>
  async (subscriptionId: string, handlers: EventHandler[]) => {
    return retryPromise(async () => {
      const currentPosition = await loadCheckpoint(subscriptionId);
      const fromPosition = !currentPosition
        ? START
        : { prepare: currentPosition, commit: currentPosition };

      const subscription = getEventStore().subscribeToAll({
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
          console.error(
            `Received error: %s. Retrying.`,
            error ?? 'UNEXPECTED ERROR',
          );
          throw error;
        }
      })();
      console.info('Subscription is running');

      return subscription;
    });
  };

//////////////////////////////////////
/// PostgreSQL Checkpointing
//////////////////////////////////////

export const getCheckpoints = () => subscriptionCheckpoints(getPostgres());

export const loadCheckPointFromPostgres = async (subscriptionId: string) => {
  const checkpoints = getCheckpoints();

  const checkpoint = await checkpoints.findOne({
    id: subscriptionId,
  });

  return checkpoint != null ? BigInt(checkpoint.position) : undefined;
};

export type PostgresEventHandler = (
  db: Transaction,
  event: SubscriptionResolvedEvent,
) => Promise<void>;

const storeCheckpointInPostgres = async (event: SubscriptionResolvedEvent) => {
  const checkpoints = getCheckpoints();

  await checkpoints.insertOrUpdate(['id'], {
    id: event.subscriptionId,
    position: Number(event.commitPosition),
  });
};

export const handleEventInPostgresTransactionScope =
  (handlers: PostgresEventHandler[]) =>
  async (event: SubscriptionResolvedEvent) => {
    await getPostgres().tx(async (transaction) => {
      await transaction.task(async (db) => {
        for (const handle of handlers) {
          await handle(db, event);
        }
        await storeCheckpointInPostgres(event);
      });
    });
  };

export const SubscriptionToAllWithPostgresCheckpoints = SubscriptionToAll(
  getEventStore,
  loadCheckPointFromPostgres,
);
