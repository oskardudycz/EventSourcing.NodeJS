import { EventStoreDBClient } from '@eventstore/db-client';
import { SubscribeToAllOptions } from '@eventstore/db-client/dist/streams';
import { ReadableOptions } from 'node:stream';
import { v4 as uuid } from 'uuid';
import { Event } from '../../events';
import { getSubscriptionToAll } from '.';
import { Result } from '../../primitives';
import { loadCheckpoint, storeCheckpoint } from './checkpoints';
import { Subscription } from './subscription';

export function getSubscriptionToAllWithESDBCheckpointing<
  StreamEvent extends Event,
  TError = never
>(
  eventStore: EventStoreDBClient,
  handlers: ((
    event: StreamEvent,
    options: { position: bigint; revision: bigint; streamName: string }
  ) => Promise<Result<boolean, TError>>)[],
  subscriptionId: string = uuid(),
  options?: SubscribeToAllOptions,
  readableOptions?: ReadableOptions
): Result<Subscription> {
  return getSubscriptionToAll(
    eventStore,
    (subscriptionId) => loadCheckpoint(eventStore, subscriptionId),
    (subscriptionId, position) =>
      storeCheckpoint(eventStore, subscriptionId, position),
    handlers,
    subscriptionId,
    options,
    readableOptions
  );
}
