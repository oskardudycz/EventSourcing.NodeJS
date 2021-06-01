import { Event, isEvent } from '../../events';

export async function add<Command, StreamEvent extends Event, Error = never>(
  store: (streamName: string, newEvent: StreamEvent) => Promise<boolean>,
  streamName: string,
  command: Command,
  handle: (command: Command) => StreamEvent | Error
): Promise<boolean | Error | never> {
  const newEvent = handle(command);

  if (!isEvent(newEvent)) {
    return newEvent;
  }

  return store(streamName, newEvent);
}
