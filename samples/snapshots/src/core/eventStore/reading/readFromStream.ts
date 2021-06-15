import { ErrorType, EventStoreDBClient } from '@eventstore/db-client';
import { ReadStreamOptions } from '@eventstore/db-client/dist/streams';

import { Event } from '../../events';
import { failure, Result, success } from '../../primitives';

export type STREAM_NOT_FOUND = 'STREAM_NOT_FOUND';

export type ReadFromStreamOptions = {
  toPosition?: bigint;
} & ReadStreamOptions;

export async function readFromStream<StreamEvent extends Event>(
  client: EventStoreDBClient,
  streamName: string,
  options?: ReadFromStreamOptions
): Promise<Result<StreamEvent[], STREAM_NOT_FOUND>> {
  let events;
  try {
    events = await client.readStream(streamName, options);
  } catch (error) {
    if (error.type == ErrorType.STREAM_NOT_FOUND) {
      return failure('STREAM_NOT_FOUND');
    }

    throw error;
  }

  const toPosition = options?.toPosition;

  return success(
    events
      .filter(
        (resolvedEvent) =>
          !!resolvedEvent.event &&
          (toPosition === undefined ||
            (resolvedEvent.commitPosition ?? 0) < toPosition)
      )
      .map((resolvedEvent) => {
        return <StreamEvent>{
          type: resolvedEvent.event!.type,
          data: resolvedEvent.event!.data,
          metadata: resolvedEvent.event?.metadata,
        };
      })
  );
}
