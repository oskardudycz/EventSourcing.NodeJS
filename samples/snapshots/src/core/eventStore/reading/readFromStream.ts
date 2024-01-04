import {
  ErrorType,
  EventStoreDBClient,
  StreamNotFoundError,
} from '@eventstore/db-client';
import { ReadStreamOptions } from '@eventstore/db-client/dist/streams';
import { STREAM_NOT_FOUND } from '.';

import { Event } from '../../events';
import { failure, Result, success } from '../../primitives';

export type ReadFromStreamOptions = {
  toPosition?: bigint;
} & ReadStreamOptions;

export async function readFromStream<StreamEvent extends Event>(
  eventStore: EventStoreDBClient,
  streamName: string,
  options?: ReadFromStreamOptions,
): Promise<Result<StreamEvent[], STREAM_NOT_FOUND>> {
  const events = [];

  const toPosition = options?.toPosition;

  try {
    for await (const { event } of eventStore.readStream<StreamEvent>(
      streamName,
      options,
    )) {
      if (!event) continue;

      if (
        toPosition != undefined &&
        (event.position?.commit ?? 0) >= toPosition
      )
        break;

      events.push(<StreamEvent>{
        type: event.type,
        data: event.data,
        metadata: event.metadata,
      });
    }
    return success(events);
  } catch (error) {
    if (error instanceof StreamNotFoundError) {
      return failure('STREAM_NOT_FOUND');
    }

    throw error;
  }
}
