import {
  EventStoreDBClient,
  NO_STREAM,
  Position,
  STREAM_EXISTS,
} from '@eventstore/db-client';
import { failure, Result, success } from '../../primitives';
import { Event } from '../../events';
import { readLastEventFromStream } from '../reading';
import { appendToStream } from '../appending';
import { getCurrentTime } from '../../primitives';

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
      checkPointedAt: getCurrentTime(),
    },
  };

  let result = await appendToStream(eventStore, streamName, [event], {
    expectedRevision: STREAM_EXISTS,
  });

  if (!result.isError) {
    return success(true);
  }

  const wasMetadataSet = await eventStore.setStreamMetadata(streamName, {
    maxCount: 1,
  });

  if (!wasMetadataSet) return failure('FAILED_TO_STORE_CHECKPOINT');

  result = await appendToStream(eventStore, streamName, [event], {
    expectedRevision: NO_STREAM,
  });

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

  const { commit, prepare } = result.value.event.data;

  return success({ commit: BigInt(commit), prepare: BigInt(prepare) });
}
