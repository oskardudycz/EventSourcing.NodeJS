import { EventStoreDBClient } from '@eventstore/db-client';
import { AppendToStreamOptions } from '@eventstore/db-client/dist/streams';
import { AppendResult } from '.';

import { failure, Result, success } from '../../primitives';

export type FAILED_TO_SET_STREAM_METADATA = 'FAILED_TO_SET_STREAM_METADATA';

export async function setStreamMetadata<
  StreamMetadata extends Record<string, unknown>
>(
  client: EventStoreDBClient,
  streamName: string,
  metadata: StreamMetadata,
  options?: AppendToStreamOptions
): Promise<Result<AppendResult, FAILED_TO_SET_STREAM_METADATA>> {
  try {
    const {
      success: wasAppended,
      nextExpectedRevision,
      position,
    } = await client.setStreamMetadata<StreamMetadata>(
      streamName,
      metadata,
      options
    );

    if (!wasAppended) return failure('FAILED_TO_SET_STREAM_METADATA');

    return success({ nextExpectedRevision, position });
  } catch (error) {
    console.log(error);
    return failure('FAILED_TO_SET_STREAM_METADATA');
  }
}
