import { Event } from './event';
import { Command } from './command';

export type EnqueuedEvent<EventType extends Event> = Readonly<{
  type: 'Event';
  data: EventType;
}>;

export type ScheduledCommand<CommandType extends Command> = Readonly<{
  type: 'Command';
  data: CommandType;
}>;

export type ProcesssingResult<
  CommandType extends Command,
  EventType extends Event
> = ScheduledCommand<CommandType> | EnqueuedEvent<EventType>;

export const enqueue = <EventType extends Event>(
  event: EventType
): EnqueuedEvent<EventType> => {
  return { type: 'Event', data: event };
};

export const schedule = <CommandType extends Command>(
  command: CommandType
): ScheduledCommand<CommandType> => {
  return { type: 'Command', data: command };
};
