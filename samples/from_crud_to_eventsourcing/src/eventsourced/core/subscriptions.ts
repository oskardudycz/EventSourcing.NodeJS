import { getPostgres } from '#core/postgres';
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

export const storeCheckpointInPostgres =
  (handle: EventHandler) => async (event: SubscriptionResolvedEvent) => {
    await handle(event);
    const checkpoints = getCheckpoints();

    await checkpoints.insertOrUpdate(['id'], {
      id: event.subscriptionId,
      position: Number(event.commitPosition!),
    });
  };

export const SubscriptionToAllWithPostgresCheckpoints = SubscriptionToAll(
  getEventStore(),
  loadCheckPointFromPostgres
);
