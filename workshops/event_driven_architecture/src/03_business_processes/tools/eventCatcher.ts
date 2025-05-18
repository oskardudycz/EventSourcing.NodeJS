import { type Event } from './eventBus';

export type EventCatcher = {
  catchMessage: (event: Event) => void;
  reset: () => void;
  shouldReceiveSingleEvent: (expectedEvent: Event) => void;
};

export const getEventCatcher = (): EventCatcher => {
  let events: Event[] = [];

  return {
    catchMessage: (event: Event): void => {
      events.push(event);
    },
    reset: (): void => {
      events = [];
    },
    shouldReceiveSingleEvent: (expectedEvent: Event): void => {
      expect(events.length).toBe(1);
      expect(events[0]).toEqual(expectedEvent);
    },
  };
};
