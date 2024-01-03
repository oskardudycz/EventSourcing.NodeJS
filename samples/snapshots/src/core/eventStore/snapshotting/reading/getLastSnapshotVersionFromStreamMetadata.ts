import { EventStoreDBClient } from '@eventstore/db-client';
import { failure, Result, success } from '../../../primitives';
import { STREAM_NOT_FOUND } from '../../reading';
import { readStreamMetadata } from '../../reading/readStreamMetadata';
import { SnapshotMetadata } from '../snapshotEvent';

export async function getLastSnapshotVersionFromStreamMetadata(
  eventStore: EventStoreDBClient,
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
