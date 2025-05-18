import { type Command } from './commandBus';
import { type Event } from './eventBus';

export type Message = Event | Command;

export type MessageCatcher = {
  catchMessage: (event: Message) => void;
  reset: () => void;
  shouldReceiveSingleMessage: (expectedMessage: Message) => void;
  shouldReceiveMessages: (expectedMessages: Message[]) => void;
};

export const getMessageCatcher = (): MessageCatcher => {
  let events: Message[] = [];

  return {
    catchMessage: (event: Message): void => {
      events.push(event);
    },
    reset: (): void => {
      events = [];
    },
    shouldReceiveSingleMessage: (expectedMessage: Message): void => {
      expect(events.length).toBe(1);
      expect(events[0]).toEqual(expectedMessage);
    },
    shouldReceiveMessages: (expectedMessages: Message[]): void => {
      expect(events.length).toBe(expectedMessages.length);
      expect(events).toMatchObject(expectedMessages);
    },
  };
};
