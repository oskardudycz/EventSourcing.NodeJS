export class Event {}

export interface EventBus {
  publish<E extends Event>(event: E): Promise<void>;
}

export interface EventHandler<E extends Event> {
  handle(event: E): Promise<void>;
}

type RegisteredHandler =
  | {
      canHandle: true;
      handle: (event: Event) => Promise<void>;
    }
  | { canHandle: false };

// eslint-disable-next-line  @typescript-eslint/no-explicit-any
type Constructor<T> = new (...args: any[]) => T;

let eventBus: EventBus | undefined;
const eventHandlers: ((event: Event) => RegisteredHandler)[] = [];

export const EventBusFactory = (): EventBus => {
  if (eventBus === undefined) {
    eventBus = {
      publish: async <E extends Event>(event: E): Promise<void> => {
        const handlers = eventHandlers
          .map((handler) => handler(event))
          .filter((handler) => handler.canHandle);

        for (const handler of handlers) {
          if (!handler.canHandle) continue;

          await handler.handle(event);
        }
      },
    };
  }

  return eventBus;
};

export const registerEventHandler = <C extends Event>(
  eventType: Constructor<C>,
  eventHandler: EventHandler<C>
) => {
  return eventHandlers.push((event: Event) => {
    if (!(event instanceof eventType)) {
      return {
        canHandle: false,
      };
    }

    return {
      canHandle: true,
      handle: () => eventHandler.handle(event),
    };
  });
};
