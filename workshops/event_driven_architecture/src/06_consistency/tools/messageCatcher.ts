import type { Message } from './messageBus';
import { expect } from 'vitest';

export type MessageCatcher = {
  readonly published: Message[];
  catchMessage: (message: Message) => void;
  reset: () => void;
  shouldNotReceiveAnyMessage: () => void;
  shouldReceiveSingleMessage: (expectedMessage: Message) => void;
  shouldReceiveMessages<ExpectedTypes extends Message>(
    expectedMessages: ExpectedTypes[],
  ): void;
  shouldReceiveMessagesInAnyOrder<ExpectedTypes extends Message>(
    expectedMessages: ExpectedTypes[],
  ): void;
};

export const getMessageCatcher = (): MessageCatcher => {
  let messages: Message[] = [];

  return {
    get published(): Message[] {
      return messages;
    },
    catchMessage: (message: Message): void => {
      messages.push(message);
    },
    reset: (): void => {
      messages = [];
    },
    shouldNotReceiveAnyMessage: (): void => {
      expect(messages).toEqual([]);
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
    shouldReceiveMessagesInAnyOrder: <ExpectedTypes extends Message>(
      expectedMessages: ExpectedTypes[],
    ): void => {
      expect(messages.length).toBe(expectedMessages.length);
      expect(messages).toEqual(
        expect.arrayContaining<Message>(expectedMessages),
      );
    },
  };
};
