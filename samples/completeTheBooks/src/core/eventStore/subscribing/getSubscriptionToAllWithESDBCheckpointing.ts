import { EventStoreDBClient } from '@eventstore/db-client';
import { SubscribeToAllOptions } from '@eventstore/db-client/dist/streams';
import { ReadableOptions } from 'stream';
import { v4 as uuid } from 'uuid';
import { StreamEvent } from '../../events';
import { getSubscriptionToAll } from '.';
import { Result } from '../../primitives';
import { loadCheckpoint, storeCheckpoint } from './checkpoints';
import { Subscription } from './subscription';

export function getSubscriptionToAllWithESDBCheckpointing<TError = never>(
  eventStore: EventStoreDBClient,
  handlers: ((event: StreamEvent) => Promise<Result<boolean, TError>>)[],
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
