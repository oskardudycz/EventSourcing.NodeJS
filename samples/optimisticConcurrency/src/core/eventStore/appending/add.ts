import type { Event } from '../../events';
import { NO_STREAM } from '@kurrent/kurrentdb-client';
import type { Result } from '../../primitives';
import type { FAILED_TO_APPEND_EVENT } from '.';
import type { AppendResult } from './appendToStream';
import { appendToStream } from './appendToStream';
import { getEventStore } from '..';

export async function add<
  Command,
  StreamEvent extends Event,
  HANDLE_ERROR = never,
  STORE_ERROR = never,
>(
  handle: (command: Command) => Result<StreamEvent, HANDLE_ERROR>,
  streamName: string,
  command: Command,
): Promise<
  Result<AppendResult, FAILED_TO_APPEND_EVENT | HANDLE_ERROR | STORE_ERROR>
> {
  const handleResult = handle(command);

  if (handleResult.isError) return handleResult;

  const newEvent = handleResult.value;

  return appendToStream(getEventStore(), streamName, [newEvent], {
    streamState: NO_STREAM,
  });
}
