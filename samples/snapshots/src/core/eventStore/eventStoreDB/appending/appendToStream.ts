import {
  EventData,
  EventStoreDBClient,
  jsonEvent,
  Position,
} from '@eventstore/db-client';

import { Event } from '../../../events';
import { failure, Result, success } from '../../../primitives/result';

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

export type WRONG_EXPECTED_VERSION = 'WRONG_EXPECTED_VERSION';

export async function appendToStream<StreamEvent extends Event>(
  client: EventStoreDBClient,
  streamName: string,
  ...events: StreamEvent[]
): Promise<Result<AppendResult, WRONG_EXPECTED_VERSION>> {
  const jsonEvents: EventData[] = events.map((event) =>
    jsonEvent({ type: event.type, data: event.data, metadata: event.metadata })
  );

  const {
    success: wasAppended,
    nextExpectedRevision,
    position,
  } = await client.appendToStream(streamName, jsonEvents);

  if (!wasAppended) return failure('WRONG_EXPECTED_VERSION');

  return success({ nextExpectedRevision, position });
}
