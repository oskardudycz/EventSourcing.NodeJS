import type { KurrentDBClient } from '@kurrent/kurrentdb-client';
import type { AppendToStreamOptions } from '@kurrent/kurrentdb-client';
import type { AppendResult } from '.';

import type { Result } from '../../primitives';
import { failure, success } from '../../primitives';

export type FAILED_TO_SET_STREAM_METADATA = 'FAILED_TO_SET_STREAM_METADATA';

export async function setStreamMetadata<
  StreamMetadata extends Record<string, unknown>,
>(
  client: KurrentDBClient,
  streamName: string,
  metadata: StreamMetadata,
  options?: AppendToStreamOptions,
): Promise<Result<AppendResult, FAILED_TO_SET_STREAM_METADATA>> {
  try {
    const {
      success: wasAppended,
      nextExpectedRevision,
      position,
    } = await client.setStreamMetadata<StreamMetadata>(
      streamName,
      metadata,
      options,
    );

    if (!wasAppended) return failure('FAILED_TO_SET_STREAM_METADATA');

    return success({ nextExpectedRevision, position });
  } catch (error) {
    console.log(error);
    return failure('FAILED_TO_SET_STREAM_METADATA');
  }
}
