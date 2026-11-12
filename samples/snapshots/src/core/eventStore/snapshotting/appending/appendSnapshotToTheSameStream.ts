import type { KurrentDBClient } from '@kurrent/kurrentdb-client';
import type { SnapshotEvent } from '..';
import { pipeResultAsync } from '../../../primitives/pipe';
import type { Result } from '../../../primitives';
import { success } from '../../../primitives';
import type {
  AppendResult,
  FAILED_TO_APPEND_EVENT,
} from '../../appending/appendToStream';
import { appendToStream } from '../../appending/appendToStream';

export async function appendSnapshotToTheSameStream<
  SnapshotStreamEvent extends SnapshotEvent,
>(
  eventStore: KurrentDBClient,
  snapshot: SnapshotStreamEvent,
  streamName: string,
): Promise<Result<AppendResult, FAILED_TO_APPEND_EVENT>> {
  return pipeResultAsync(
    () => appendToStream(eventStore, streamName, [snapshot]),
    async (result) => {
      const { nextExpectedRevision: lastSnapshotVersion } = result;
      await eventStore.setStreamMetadata(streamName, {
        lastSnapshotVersion,
      });
      return success(result);
    },
  )();
}
