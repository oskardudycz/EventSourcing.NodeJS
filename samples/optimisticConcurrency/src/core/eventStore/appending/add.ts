import { Event } from '../../events';
import { EventStoreDBClient, NO_STREAM } from '@eventstore/db-client';
import { Result } from '../../primitives';
import { FAILED_TO_APPEND_EVENT } from '.';
import { AppendResult, appendToStream } from './appendToStream';

export async function add<
  Command,
  StreamEvent extends Event,
  HANDLE_ERROR = never,
  STORE_ERROR = never
>(
  handle: (command: Command) => Result<StreamEvent, HANDLE_ERROR>,
  eventStore: EventStoreDBClient,
  streamName: string,
  command: Command
): Promise<
  Result<AppendResult, FAILED_TO_APPEND_EVENT | HANDLE_ERROR | STORE_ERROR>
> {
  const handleResult = handle(command);

  if (handleResult.isError) return handleResult;

  const newEvent = handleResult.value;

  return appendToStream(eventStore, streamName, [newEvent], {
    expectedRevision: NO_STREAM,
  });
}
