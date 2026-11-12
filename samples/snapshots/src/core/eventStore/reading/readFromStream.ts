import type { KurrentDBClient } from '@kurrent/kurrentdb-client';
import { StreamNotFoundError } from '@kurrent/kurrentdb-client';
import type { ReadStreamOptions } from '@kurrent/kurrentdb-client';
import type { STREAM_NOT_FOUND } from '.';

import type { Event } from '../../events';
import type { Result } from '../../primitives';
import { failure, success } from '../../primitives';

export type ReadFromStreamOptions = {
  toPosition?: bigint;
} & ReadStreamOptions;

export async function readFromStream<StreamEvent extends Event>(
  eventStore: KurrentDBClient,
  streamName: string,
  options?: ReadFromStreamOptions,
): Promise<Result<StreamEvent[], STREAM_NOT_FOUND>> {
  const events: StreamEvent[] = [];

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
