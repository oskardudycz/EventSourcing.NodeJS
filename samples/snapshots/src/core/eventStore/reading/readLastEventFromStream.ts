import type { KurrentDBClient } from '@kurrent/kurrentdb-client';
import { END } from '@kurrent/kurrentdb-client';
import type { ReadStreamOptions } from '@kurrent/kurrentdb-client';

import type { Event } from '../../events';
import type { STREAM_NOT_FOUND } from '.';
import { readFromStream } from '.';
import type { Result } from '../../primitives';
import { failure, success } from '../../primitives';

export type NO_EVENTS_FOUND = 'NO_EVENTS_FOUND';

export async function readLastEventFromStream<StreamEvent extends Event>(
  eventStore: KurrentDBClient,
  streamName: string,
  options?: ReadStreamOptions,
): Promise<Result<StreamEvent, STREAM_NOT_FOUND | NO_EVENTS_FOUND>> {
  const events = await readFromStream<StreamEvent>(eventStore, streamName, {
    maxCount: 1,
    direction: 'backwards',
    fromRevision: END,
    ...options,
  });

  if (events.isError) {
    return failure('STREAM_NOT_FOUND');
  }

  if (events.value.length === 0) return failure('NO_EVENTS_FOUND');

  return success(events.value[0]);
}
