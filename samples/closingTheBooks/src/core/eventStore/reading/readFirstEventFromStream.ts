import type { KurrentDBClient } from '@kurrent/kurrentdb-client';
import { FORWARDS, START } from '@kurrent/kurrentdb-client';
import type { ReadStreamOptions } from '@kurrent/kurrentdb-client';

import type { Event, StreamEvent } from '../../events';
import type { STREAM_NOT_FOUND } from '.';
import { readFromStream } from '.';
import type { Result } from '../../primitives';
import { failure, success } from '../../primitives';

export type NO_EVENTS_FOUND = 'NO_EVENTS_FOUND';

export async function readFirstEventFromStream<StreamEventType extends Event>(
  eventStore: KurrentDBClient,
  streamName: string,
  options?: ReadStreamOptions,
): Promise<
  Result<StreamEvent<StreamEventType>, STREAM_NOT_FOUND | NO_EVENTS_FOUND>
> {
  const events = await readFromStream<StreamEventType>(eventStore, streamName, {
    maxCount: 1,
    direction: FORWARDS,
    fromRevision: START,
    ...options,
  });

  if (events.isError) {
    return failure('STREAM_NOT_FOUND');
  }

  if (events.value.length === 0) return failure('NO_EVENTS_FOUND');

  return success(events.value[0]);
}
