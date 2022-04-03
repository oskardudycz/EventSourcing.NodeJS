import { getPostgres } from '#core/postgres';
import { Transaction } from '@databases/pg';
import {
  AllStreamResolvedEvent,
  EventStoreDBClient,
  excludeSystemEvents,
  START,
} from '@eventstore/db-client';
import { finished, Readable } from 'stream';
import { subscriptionCheckpoints } from '../db';
import { getEventStore } from './streams';

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

    finished(
      subscription.on('data', async (resolvedEvent: AllStreamResolvedEvent) => {
        for (const handler of handlers) {
          await handler({ ...resolvedEvent, subscriptionId });
        }
      }) as Readable,
      (error) => {
        if (!error) {
          console.info(`Stopping subscription.`);
          return;
        }
        console.error(`Received error: ${error ?? 'UNEXPECTED ERROR'}.`);
      }
    );
    console.info('Subscription is running');

    return subscription;
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
  event: SubscriptionResolvedEvent
) => Promise<void>;

export const storeCheckpointInPostgres =
  (handlers: PostgresEventHandler[]) =>
  async (event: SubscriptionResolvedEvent) => {
    await getPostgres().tx(async (transaction) => {
      await transaction.task(async (db) => {
        const checkpoints = getCheckpoints();

        for (const handle of handlers) {
          await handle(db, event);
        }

        await checkpoints.insertOrUpdate(['id'], {
          id: event.subscriptionId,
          position: Number(event.commitPosition!),
        });
      });
    });
  };

export const SubscriptionToAllWithPostgresCheckpoints = SubscriptionToAll(
  getEventStore(),
  loadCheckPointFromPostgres
);
