import { EventStoreDBClient, Position } from '@eventstore/db-client';
import { failure, Result, success } from '../../primitives/result';
import { Event } from '../../events';
import { readLastEventFromStream } from '../reading';
import { appendToStream } from '../eventStoreDB/appending';

export type CheckPointEvent = Event<
  'check-point',
  {
    commit: string;
    prepare: string;
    checkPointedAt: Date;
  }
>;

export type FAILED_TO_STORE_CHECKPOINT = 'FAILED_TO_STORE_CHECKPOINT';

export function getCheckpointStreamPrefix(subscriptionId: string) {
  return `checkpoint_${subscriptionId}`;
}

export async function storeCheckpoint(
  eventStore: EventStoreDBClient,
  subscriptionId: string,
  position: bigint
): Promise<Result<true, FAILED_TO_STORE_CHECKPOINT>> {
  const streamName = getCheckpointStreamPrefix(subscriptionId);

  const commit = position.toString();

  const event: CheckPointEvent = {
    type: 'check-point',
    data: {
      commit,
      prepare: commit,
      checkPointedAt: new Date(),
    },
  };

  const result = await appendToStream(eventStore, streamName, event);

  if (result.isError) return failure('FAILED_TO_STORE_CHECKPOINT');

  return success(true);
}

export async function loadCheckpoint(
  eventStore: EventStoreDBClient,
  subscriptionId: string
): Promise<Result<Position | undefined>> {
  const streamName = getCheckpointStreamPrefix(subscriptionId);

  const result = await readLastEventFromStream<CheckPointEvent>(
    eventStore,
    streamName
  );

  if (result.isError === true) return success(undefined);

  const { commit, prepare } = result.value.data;

  return success({ commit: BigInt(commit), prepare: BigInt(prepare) });
}
