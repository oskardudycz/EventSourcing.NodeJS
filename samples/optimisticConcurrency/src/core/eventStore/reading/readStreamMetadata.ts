import type { KurrentDBClient } from '@kurrent/kurrentdb-client';
import { StreamNotFoundError } from '@kurrent/kurrentdb-client';
import type { GetStreamMetadataOptions } from '@kurrent/kurrentdb-client';
import type { STREAM_NOT_FOUND, METADATA_NOT_FOUND } from './';
import type { Result } from '../../primitives';
import { failure, success } from '../../primitives';

export async function readStreamMetadata<
  StreamMetadata extends Record<string, unknown>,
>(
  eventStore: KurrentDBClient,
  streamName: string,
  options?: GetStreamMetadataOptions,
): Promise<Result<StreamMetadata, STREAM_NOT_FOUND | METADATA_NOT_FOUND>> {
  try {
    const result = await eventStore.getStreamMetadata<StreamMetadata>(
      streamName,
      options,
    );

    if (!result.metadata) return failure('METADATA_NOT_FOUND');

    return success(result.metadata);
  } catch (error) {
    if (error instanceof StreamNotFoundError) {
      return failure('STREAM_NOT_FOUND');
    }

    throw error;
  }
}
