import { Event, isEvent } from '../../events';
import { failure, Result, success } from '../../primitives/result';

export async function add<Command, StreamEvent extends Event, Error = never>(
  store: (streamName: string, newEvent: StreamEvent) => Promise<boolean>,
  streamName: string,
  command: Command,
  handle: (command: Command) => StreamEvent | Error
): Promise<Result<boolean, Error>> {
  const newEvent = handle(command);

  if (!isEvent(newEvent)) {
    return failure(newEvent);
  }

  return success(await store(streamName, newEvent));
}
