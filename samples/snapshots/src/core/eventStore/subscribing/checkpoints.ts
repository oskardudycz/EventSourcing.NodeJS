import type { KurrentDBClient, Position } from '@kurrent/kurrentdb-client';
import { NO_STREAM, STREAM_EXISTS } from '@kurrent/kurrentdb-client';
import type { Result } from '../../primitives';
import { failure, success } from '../../primitives';
import type { Event } from '../../events';
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
  eventStore: KurrentDBClient,
  subscriptionId: string,
  position: bigint,
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
    streamState: STREAM_EXISTS,
  });

  if (!result.isError) {
    return success(true);
  }

  const wasMetadataSet = await eventStore.setStreamMetadata(streamName, {
    maxCount: 1,
  });

  if (!wasMetadataSet) return failure('FAILED_TO_STORE_CHECKPOINT');

  result = await appendToStream(eventStore, streamName, [event], {
    streamState: NO_STREAM,
  });

  if (result.isError) return failure('FAILED_TO_STORE_CHECKPOINT');

  return success(true);
}

export async function loadCheckpoint(
  eventStore: KurrentDBClient,
  subscriptionId: string,
): Promise<Result<Position | undefined>> {
  const streamName = getCheckpointStreamPrefix(subscriptionId);

  const result = await readLastEventFromStream<CheckPointEvent>(
    eventStore,
    streamName,
  );

  if (result.isError === true) return success(undefined);

  const { commit, prepare } = result.value.data;

  return success({ commit: BigInt(commit), prepare: BigInt(prepare) });
}
