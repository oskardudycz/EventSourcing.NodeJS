import {
  EventData,
  EventStoreDBClient,
  jsonEvent,
  Position,
} from '@eventstore/db-client';
import { AppendToStreamOptions } from '@eventstore/db-client/dist/streams';

import { Event } from '../../events';
import { failure, Result, success } from '../../primitives';

export interface AppendResult {
  /**
   * The current revision of the stream, to be passed as the `expectedRevision` in the next call.
   */
  nextExpectedRevision: bigint;
  /**
   * The logical record position in the EventStoreDB transaction file.
   */
  position?: Position;
}

export type FAILED_TO_APPEND_EVENT = 'FAILED_TO_APPEND_EVENT';

export async function appendToStream<StreamEvent extends Event>(
  client: EventStoreDBClient,
  streamName: string,
  events: StreamEvent[],
  options?: AppendToStreamOptions
): Promise<Result<AppendResult, FAILED_TO_APPEND_EVENT>> {
  try {
    const jsonEvents: EventData[] = events.map((event) =>
      jsonEvent({
        type: event.type,
        data: event.data,
        metadata: event.metadata,
      })
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
