import { getMongoCollection, toObjectId } from '#core/postgres';
import {
  AllStreamResolvedEvent,
  EventStoreDBClient,
  excludeSystemEvents,
  START,
} from '@eventstore/db-client';
import { finished, Readable } from 'stream';
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
/// MongoDB Checkpointing
//////////////////////////////////////

export const getCheckpointsCollection = () =>
  getMongoCollection<Checkpoint>('checkpoints');

export const loadCheckPointFromCollection = async (subscriptionId: string) => {
  const checkpoints = await getCheckpointsCollection();

  const checkpoint = await checkpoints.findOne({
    _id: toObjectId(subscriptionId),
  });

  return checkpoint != null ? BigInt(checkpoint.position) : undefined;
};

export const storeCheckpointInCollection =
  (handle: EventHandler) => async (event: SubscriptionResolvedEvent) => {
    await handle(event);
    const checkpoints = await getCheckpointsCollection();

    await checkpoints.updateOne(
      {
        _id: toObjectId(event.subscriptionId),
      },
      {
        $set: {
          position: event.commitPosition!.toString(),
        },
      },
      {
        upsert: true,
      }
    );
  };

export const SubscriptionToAllWithMongoCheckpoints = SubscriptionToAll(
  getEventStore(),
  loadCheckPointFromCollection
);
