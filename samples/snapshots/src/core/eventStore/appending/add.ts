import { Event } from '../../events';
import { EventStoreDBClient } from '@eventstore/db-client';
import { Result } from '../../primitives/result';
import { FAILED_TO_APPEND_EVENT } from '.';

export async function add<
  Command,
  StreamEvent extends Event,
  HANDLE_ERROR = never,
  STORE_ERROR = never
>(
  handle: (command: Command) => Result<StreamEvent, HANDLE_ERROR>,
  store: (
    eventStore: EventStoreDBClient,
    streamName: string,
    currentEvents: StreamEvent[],
    newEvent: StreamEvent,
    lastSnapshotVersion?: bigint | undefined
  ) => Promise<Result<boolean, FAILED_TO_APPEND_EVENT | STORE_ERROR>>,
  eventStore: EventStoreDBClient,
  streamName: string,
  command: Command
): Promise<
  Result<boolean, FAILED_TO_APPEND_EVENT | HANDLE_ERROR | STORE_ERROR>
> {
  const handleResult = handle(command);

  if (handleResult.isError) return handleResult;

  const newEvent = handleResult.value;

  return store(eventStore, streamName, [], newEvent);
}
