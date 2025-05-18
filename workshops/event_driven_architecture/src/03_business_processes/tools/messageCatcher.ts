import { type Command } from './commandBus';
import { type Event } from './eventBus';

export type Message = Event | Command;

export type MessageCatcher = {
  catchMessage: (event: Message) => void;
  reset: () => void;
  shouldReceiveSingleMessage: (expectedMessage: Message) => void;
  shouldReceiveMessages<ExpectedTypes extends Message>(
    expectedMessages: ExpectedTypes[],
  ): void;
};

export const getMessageCatcher = (): MessageCatcher => {
  let messages: Message[] = [];

  return {
    catchMessage: (event: Message): void => {
      messages.push(event);
    },
    reset: (): void => {
      messages = [];
    },
    shouldReceiveSingleMessage: (expectedMessage: Message): void => {
      expect(messages.length).toBe(1);
      expect(messages[0]).toEqual(expectedMessage);
    },
    shouldReceiveMessages: <ExpectedTypes extends Message>(
      expectedMessages: ExpectedTypes[],
    ): void => {
      expect(messages.length).toBe(expectedMessages.length);
      expect(messages).toMatchObject(expectedMessages);
    },
  };
};
