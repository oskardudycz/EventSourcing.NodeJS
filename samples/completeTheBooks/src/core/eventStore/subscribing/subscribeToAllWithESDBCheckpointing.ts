import { EventStoreDBClient } from '@eventstore/db-client';
import { SubscribeToAllOptions } from '@eventstore/db-client/dist/streams';
import { ReadableOptions } from 'node:stream';
import { v4 as uuid } from 'uuid';
import { Event } from '../../events';
import { subscribeToAll } from '.';
import { Result } from '../../primitives';
import { loadCheckpoint, storeCheckpoint } from './checkpoints';

export async function subscribeToAllWithESDBCheckpointing<
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
): Promise<Result<boolean>> {
  return subscribeToAll(
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
