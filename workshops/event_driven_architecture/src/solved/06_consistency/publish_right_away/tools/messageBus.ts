import { getTransientFailures } from './transientFailures';

export type Event<
  EventType extends string = string,
  EventData extends Record<string, unknown> = Record<string, unknown>,
> = Readonly<{
  type: Readonly<EventType>;
  data: Readonly<EventData>;
}>;

export type Command<
  CommandType extends string = string,
  CommandData extends Record<string, unknown> = Record<string, unknown>,
> = Readonly<{
  type: Readonly<CommandType>;
  data: Readonly<CommandData>;
}>;

export type Message = Event | Command;

/**
 * Delivers messages from publishers to subscribers.
 *
 * Commands and events both travel through this bus. The difference is intent, not transport:
 * - a command asks for something to be done, e.g. `RecordGuestCheckoutCompletion`.
 *   It has one intended recipient, which may accept or reject it;
 * - an event records something that already happened, e.g. `GuestCheckedOut`.
 *   Any number of subscribers may react to it, or none.
 *
 * The bus delivers each message to every subscriber registered for its type. It doesn't check
 * that a command has exactly one subscriber; that's up to how the application wires it.
 */
export interface MessageBus {
  publish<M extends Message>(messages: M[]): Promise<void>;
  subscribe<M extends Message>(
    messageType: M['type'],
    messageHandler: MessageHandler<M>,
  ): void;

  use(middleware: MessageMiddleware): void;
}

export type MessageHandler<M extends Message = Message> = (
  message: M,
) => Promise<void> | void;

export type MessageMiddleware = (message: Message) => void;

export const getMessageBus = (): MessageBus => {
  const handlers: Map<string, MessageHandler[]> = new Map();
  const middlewares: MessageMiddleware[] = [];
  const failures = getTransientFailures('Message bus not available!');

  return {
    publish: async <M extends Message>(messages: M[]): Promise<void> => {
      failures.failIfUnavailable();

      for (const message of messages) {
        for (const middleware of middlewares) middleware(message);

        const messageHandlers = handlers.get(message.type) ?? [];

        for (const handle of messageHandlers) {
          await handle(message);
        }
      }
    },
    subscribe: <M extends Message>(
      messageType: string,
      messageHandler: MessageHandler<M>,
    ): void => {
      const messageHandlers = handlers.get(messageType) ?? [];
      messageHandlers.push(messageHandler as MessageHandler);
      handlers.set(messageType, messageHandlers);
    },
    use: (middleware: MessageMiddleware): void => {
      middlewares.push(middleware);
    },
  };
};
