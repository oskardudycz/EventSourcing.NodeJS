import type { KurrentDBClient } from '@kurrent/kurrentdb-client';
import { StreamNotFoundError } from '@kurrent/kurrentdb-client';
import type { ReadStreamOptions } from '@kurrent/kurrentdb-client';
import type { STREAM_NOT_FOUND } from '.';

import type { Event, StreamEvent } from '../../events';
import type { Result } from '../../primitives';
import { failure, success } from '../../primitives';

export type ReadFromStreamOptions = {
  toPosition?: bigint;
} & ReadStreamOptions;

export async function readFromStream<StreamEventType extends Event>(
  eventStore: KurrentDBClient,
  streamName: string,
  options?: ReadFromStreamOptions,
): Promise<Result<StreamEvent<StreamEventType>[], STREAM_NOT_FOUND>> {
  try {
    const toPosition = options?.toPosition;

    const events: StreamEvent<StreamEventType>[] = [];

    for await (const resolvedEvent of eventStore.readStream(
      streamName,
      options,
    )) {
      if (resolvedEvent.event === undefined) continue;

      if (
        toPosition !== undefined &&
        (resolvedEvent.commitPosition ?? 0) === toPosition
      )
        break;

      events.push({
        streamRevision: resolvedEvent.event.revision,
        streamName: resolvedEvent.event.streamId,
        event: <StreamEventType>{
          type: resolvedEvent.event.type,
          data: resolvedEvent.event.data,
          metadata: resolvedEvent.event?.metadata,
        },
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
