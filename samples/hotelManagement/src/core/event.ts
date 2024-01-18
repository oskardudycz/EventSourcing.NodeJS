import { Flavour } from './typing';

export type Event<
  EventType extends string = string,
  EventData extends Record<string, unknown> = Record<string, unknown>,
> = Flavour<
  Readonly<{
    type: Readonly<EventType>;
    data: Readonly<EventData>;
  }>,
  'Event'
>;
