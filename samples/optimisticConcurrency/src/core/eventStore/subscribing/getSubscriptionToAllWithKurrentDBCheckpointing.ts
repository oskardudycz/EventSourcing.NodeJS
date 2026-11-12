import type { KurrentDBClient } from '@kurrent/kurrentdb-client';
import type { SubscribeToAllOptions } from '@kurrent/kurrentdb-client';
import type { ReadableOptions } from 'stream';
import { v4 as uuid } from 'uuid';
import type { StreamEvent } from '../../events';
import { getSubscriptionToAll } from '.';
import type { Result } from '../../primitives';
import { loadCheckpoint, storeCheckpoint } from './checkpoints';
import type { Subscription } from './subscription';

export function getSubscriptionToAllWithKurrentDBCheckpointing<TError = never>(
  eventStore: KurrentDBClient,
  handlers: ((event: StreamEvent) => Promise<Result<boolean, TError>>)[],
  subscriptionId: string = uuid(),
  options?: SubscribeToAllOptions,
  readableOptions?: ReadableOptions,
): Result<Subscription> {
  return getSubscriptionToAll(
    eventStore,
    (subscriptionId) => loadCheckpoint(eventStore, subscriptionId),
    (subscriptionId, position) =>
      storeCheckpoint(eventStore, subscriptionId, position),
    handlers,
    subscriptionId,
    options,
    readableOptions,
  );
}
