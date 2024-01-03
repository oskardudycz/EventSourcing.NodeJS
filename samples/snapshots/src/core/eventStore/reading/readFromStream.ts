import { ErrorType, EventStoreDBClient } from '@eventstore/db-client';
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
  try {
    const events = await eventStore.readStream(streamName, options);

    const toPosition = options?.toPosition;

    return success(
      events
        .filter(
          (resolvedEvent) =>
            !!resolvedEvent.event &&
            (toPosition === undefined ||
              (resolvedEvent.commitPosition ?? 0) < toPosition),
        )
        .map((resolvedEvent) => {
          return <StreamEvent>{
            type: resolvedEvent.event!.type,
            data: resolvedEvent.event!.data,
            metadata: resolvedEvent.event?.metadata,
          };
        }),
    );
  } catch (error) {
    if (error.type == ErrorType.STREAM_NOT_FOUND) {
      return failure('STREAM_NOT_FOUND');
    }

    throw error;
  }
}
