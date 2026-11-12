import type { KurrentDBClient } from '@kurrent/kurrentdb-client';
import type { Result } from '../../../primitives';
import { failure, success } from '../../../primitives';
import type { STREAM_NOT_FOUND } from '../../reading';
import { readStreamMetadata } from '../../reading/readStreamMetadata';
import type { SnapshotMetadata } from '../snapshotEvent';

export async function getLastSnapshotVersionFromStreamMetadata(
  eventStore: KurrentDBClient,
  streamName: string,
): Promise<Result<bigint | undefined, STREAM_NOT_FOUND>> {
  const streamMetadata = await readStreamMetadata<SnapshotMetadata>(
    eventStore,
    streamName,
  );

  if (streamMetadata.isError === true) {
    return streamMetadata.error === 'METADATA_NOT_FOUND'
      ? success(undefined)
      : failure(streamMetadata.error);
  }

  return success(BigInt(streamMetadata.value.snapshottedStreamVersion));
}
