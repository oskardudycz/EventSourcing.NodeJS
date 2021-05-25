import { Event, isEvent } from '../../events';
import { STREAM_NOT_FOUND } from '../reading';

export async function add<Command, StreamEvent extends Event, Error = never>(
  store: (streamName: string, newEvent: StreamEvent) => Promise<boolean>,
  streamName: string,
  command: Command,
  handle: (command: Command) => StreamEvent | Error
): Promise<boolean | STREAM_NOT_FOUND | Error | never> {
  const newEvent = handle(command);

  if (!isEvent(newEvent)) {
    return newEvent;
  }

  return await store(streamName, newEvent);
}
