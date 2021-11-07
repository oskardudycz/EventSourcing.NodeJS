import { ErrorType, EventStoreDBClient } from '@eventstore/db-client';
import { ReadStreamOptions } from '@eventstore/db-client/dist/streams';
import { STREAM_NOT_FOUND } from '.';

import { Event, StreamEvent } from '../../events';
import { failure, Result, success } from '../../primitives';

export type ReadFromStreamOptions = {
  toPosition?: bigint;
} & ReadStreamOptions;

export async function readFromStream<StreamEventType extends Event>(
  eventStore: EventStoreDBClient,
  streamName: string,
  options?: ReadFromStreamOptions
): Promise<Result<StreamEvent<StreamEventType>[], STREAM_NOT_FOUND>> {
  try {
    const toPosition = options?.toPosition;

    const events: StreamEvent<StreamEventType>[] = [];

    for await (const resolvedEvent of eventStore.readStream(
      streamName,
      options
    )) {
      if (resolvedEvent.event === undefined) continue;

      if (
        toPosition !== undefined &&
        (resolvedEvent.commitPosition ?? 0) === toPosition
      )
        break;

      events.push({
        streamRevision: resolvedEvent.event!.revision,
        streamName: resolvedEvent.event!.streamId,
        event: <StreamEventType>{
          type: resolvedEvent.event!.type,
          data: resolvedEvent.event!.data,
          metadata: resolvedEvent.event?.metadata,
        },
      });
    }

    return success(events);
  } catch (error: any) {
    if (error.type == ErrorType.STREAM_NOT_FOUND) {
      return failure('STREAM_NOT_FOUND');
    }

    throw error;
  }
}
