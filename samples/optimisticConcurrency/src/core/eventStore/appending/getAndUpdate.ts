import { EventStoreDBClient } from '@eventstore/db-client';
import { Event, StreamEvent } from '../../events';
import { Command } from '../../commands';
import { readFromStream, STREAM_NOT_FOUND } from '../reading';
import { appendToStream } from '../appending';
import { Result } from '../../primitives';
import { AppendResult, FAILED_TO_APPEND_EVENT } from '.';

export async function getAndUpdate<
  CommandType extends Command,
  StreamEventType extends Event,
  HANDLE_ERROR = never,
  STORE_ERROR = never
>(
  handle: (
    currentEvents: StreamEvent<StreamEventType>[],
    command: CommandType
  ) => Result<StreamEventType, HANDLE_ERROR>,
  eventStore: EventStoreDBClient,
  streamName: string,
  command: CommandType
): Promise<
  Result<
    AppendResult,
    STREAM_NOT_FOUND | FAILED_TO_APPEND_EVENT | HANDLE_ERROR | STORE_ERROR
  >
> {
  const result = await readFromStream<StreamEventType>(eventStore, streamName);

  if (result.isError) return result;

  const currentEvents = result.value;

  const handleResult = handle(currentEvents, command);

  if (handleResult.isError) return handleResult;

  const newEvent = handleResult.value;

  const expectedRevision = command.metadata?.$expectedRevision
    ? BigInt(command.metadata?.$expectedRevision)
    : undefined;

  return appendToStream(eventStore, streamName, [newEvent], {
    expectedRevision,
  });
}
