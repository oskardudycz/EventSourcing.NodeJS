import type {
  EventData,
  KurrentDBClient,
  Position,
} from '@kurrent/kurrentdb-client';
import { jsonEvent } from '@kurrent/kurrentdb-client';
import type { AppendToStreamOptions } from '@kurrent/kurrentdb-client';

import type { Event } from '../../events';
import type { Result } from '../../primitives';
import { failure, success } from '../../primitives';

export interface AppendResult {
  /**
   * The current revision of the stream, to be passed as the `expectedRevision` in the next call.
   */
  nextExpectedRevision: bigint;
  /**
   * The logical record position in the KurrentDB transaction file.
   */
  position?: Position;
}

export type FAILED_TO_APPEND_EVENT = 'FAILED_TO_APPEND_EVENT';

export async function appendToStream<StreamEvent extends Event>(
  client: KurrentDBClient,
  streamName: string,
  events: StreamEvent[],
  options?: AppendToStreamOptions,
): Promise<Result<AppendResult, FAILED_TO_APPEND_EVENT>> {
  try {
    const jsonEvents: EventData[] = events.map((event) =>
      jsonEvent({
        type: event.type,
        data: event.data,
        metadata: event.metadata,
      }),
    );

    const {
      success: wasAppended,
      nextExpectedRevision,
      position,
    } = await client.appendToStream(streamName, jsonEvents, options);

    if (!wasAppended) return failure('FAILED_TO_APPEND_EVENT');

    return success({ nextExpectedRevision, position });
  } catch (error) {
    console.error(error);
    return failure('FAILED_TO_APPEND_EVENT');
  }
}
