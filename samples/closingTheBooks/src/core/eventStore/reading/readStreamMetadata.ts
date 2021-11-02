import { ErrorType, EventStoreDBClient } from '@eventstore/db-client';
import { GetStreamMetadataOptions } from '@eventstore/db-client/dist/streams';
import { STREAM_NOT_FOUND, METADATA_NOT_FOUND } from './';
import { failure, Result, success } from '../../primitives';

export async function readStreamMetadata<
  StreamMetadata extends Record<string, unknown>
>(
  eventStore: EventStoreDBClient,
  streamName: string,
  options?: GetStreamMetadataOptions
): Promise<Result<StreamMetadata, STREAM_NOT_FOUND | METADATA_NOT_FOUND>> {
  try {
    const result = await eventStore.getStreamMetadata<StreamMetadata>(
      streamName,
      options
    );

    if (!result.metadata) return failure('METADATA_NOT_FOUND');

    return success(result.metadata);
  } catch (error) {
    if (error.type == ErrorType.STREAM_NOT_FOUND) {
      return failure('STREAM_NOT_FOUND');
    }

    throw error;
  }
}
