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

const isStrictlyEqual = (actual: Message, expected: Message): boolean => {
  try {
    expect(actual).toStrictEqual(expected);
    return true;
  } catch {
    return false;
  }
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
      expect(messages[0]).toStrictEqual(expectedMessage);
    },
    shouldReceiveMessages: <ExpectedTypes extends Message>(
      expectedMessages: ExpectedTypes[],
    ): void => {
      expect(messages.length).toBe(expectedMessages.length);
      expect(messages).toStrictEqual(expectedMessages);
    },
    shouldReceiveMessagesInAnyOrder: <ExpectedTypes extends Message>(
      expectedMessages: ExpectedTypes[],
    ): void => {
      expect(messages.length).toBe(expectedMessages.length);

      const notMatched = [...messages];
      for (const expectedMessage of expectedMessages) {
        const index = notMatched.findIndex((message) =>
          isStrictlyEqual(message, expectedMessage),
        );
        expect(index, JSON.stringify(expectedMessage)).toBeGreaterThanOrEqual(
          0,
        );
        notMatched.splice(index, 1);
      }
    },
  };
};
